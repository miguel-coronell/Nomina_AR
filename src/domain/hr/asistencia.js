/**
 * CONTROL DE ASISTENCIA — evaluación pura de cada día y resumen de un período.
 *
 * Registro de un día: { t: 'T'|'FI'|'FJ'|'L'|'NL'|'BH'|'SG', h?: horas, l?: licencia, rec?: '50'|'100', n?: nota }
 *
 * Reglas (art. 201 LCT, art. 166 LCT; la Ley 27.802 mantuvo los recargos y sumó el banco de horas, art. 197 bis):
 *  - Horas sobre la jornada pactada de un día hábil: recargo 50 % (sábado: 100 %; se puede ajustar por día).
 *  - Día de descanso (domingo o franco semanal) y feriados sin jornada pactada: todas las horas al 100 %.
 *  - Feriado trabajado en día con jornada pactada: se abona un día adicional (doble jornal, art. 166)
 *    y las horas que excedan la jornada, al 100 %.
 *  - Con banco de horas pactado por escrito, las extras no se pagan: se acumulan para compensarlas con francos.
 */
import { addDays, parseISO, toISO, toUTC } from '../../core/dates.js';
import { horasPactadas, normalizarHorario, dowOf } from './horario.js';
import { horasDe, turnoAbierto } from './horas.js';

/** Límites habituales de horas suplementarias (Dto. 484/2000). Verificá si tu convenio o actividad tiene otro régimen. */
export const LIMITES_EXTRAS = { diario: 3, mensual: 30, anual: 200 };
export const LIMITE_PASANTIA = { semanal: 20, diario: 6.5 };

const n = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : 0; };
const r2 = (x) => Math.round(x * 100) / 100;

/** Evalúa un día. `fer` = entrada del mapa de feriados (o undefined). */
export function evaluarDia(emp, iso, rec, fer) {
  const horario = normalizarHorario(emp.horario);
  const dow = dowOf(iso);
  const pact = horario[dow] || 0;
  const esFeriado = fer?.tipo === 'feriado';
  const esNoLab = fer?.tipo === 'no_laborable';
  const out = { iso, dow, pact, esFeriado, esNoLab, ferNombre: fer?.nombre || '', laborable: pact > 0 && !esFeriado,
    t: rec?.t || '', horas: 0, normales: 0, he50: 0, he100: 0, feriadoTrab: 0, faltante: 0, bancoGen: 0, bancoUsado: 0 };
  if (!rec) return out;

  if (rec.t === 'T') {
    const h = horasDe(rec, emp.descansoMin);
    out.horas = h;
    out.abierto = turnoAbierto(rec);
    if (esFeriado && pact > 0) {
      out.feriadoTrab = h > 0 ? 1 : 0; out.normales = Math.min(h, pact); out.he100 = Math.max(0, h - pact);
    } else if (esFeriado || pact === 0) {
      if (rec.rec === '50') out.he50 = h; else out.he100 = h;
    } else {
      out.normales = Math.min(h, pact);
      const ex = Math.max(0, h - pact);
      out.faltante = Math.max(0, pact - h);
      if ((rec.rec || (dow === 6 ? '100' : '50')) === '100') out.he100 = ex; else out.he50 = ex;
    }
    if (emp.bancoHoras) { out.bancoGen = r2(out.he50 + out.he100); out.he50 = 0; out.he100 = 0; }
  } else if (rec.t === 'BH') {
    out.bancoUsado = n(rec.h) || pact;
  }
  return out;
}

/** Recorre desde..hasta (ISO) y suma. `days` = { 'YYYY-MM-DD': registro }. `hoy` limita el conteo de "sin registrar". */
export function resumenPeriodo(emp, desde, hasta, days = {}, feriados = new Map(), { hoy } = {}) {
  const res = { desde, hasta, diasTrab: 0, hsTrab: 0, hsNormales: 0, he50: 0, he100: 0, feriadosTrab: 0, faltasInj: 0, faltasJust: 0,
    sinGoce: 0, vacaciones: 0, licencias: 0, noLab: 0, hsFaltantes: 0, bancoGen: 0, bancoUsado: 0, sinRegistrar: 0, hsPactadas: 0, abiertos: 0, avisos: [], dias: [] };
  const lic = {};
  let p = parseISO(desde);
  const fin = toUTC(parseISO(hasta));
  const semanas = new Map();
  while (toUTC(p) <= fin) {
    const iso = toISO(p);
    const ev = evaluarDia(emp, iso, days[iso], feriados.get(iso));
    res.dias.push(ev);
    if (ev.laborable && iso >= (emp.fechaIngreso || '') && (!emp.fechaEgreso || iso <= emp.fechaEgreso)) res.hsPactadas += ev.pact;
    if (ev.abierto) { res.abiertos += 1; res.avisos.push(`${iso.slice(8)}/${iso.slice(5, 7)}: entrada sin salida registrada (no suma horas hasta cargar la salida).`); }
    if (ev.t === 'T') {
      if (ev.horas > 0) res.diasTrab += 1;
      res.hsTrab += ev.horas; res.hsNormales += ev.normales; res.he50 += ev.he50; res.he100 += ev.he100;
      res.feriadosTrab += ev.feriadoTrab; res.hsFaltantes += ev.faltante; res.bancoGen += ev.bancoGen;
      if (ev.horas > 16) res.avisos.push(`${iso.slice(8)}/${iso.slice(5, 7)}: ${r2(ev.horas)} hs en un solo día. Revisá las marcaciones (¿salida anterior a la entrada?).`);
      if (ev.he50 + ev.he100 + ev.bancoGen > LIMITES_EXTRAS.diario) res.avisos.push(`${iso.slice(8)}/${iso.slice(5, 7)}: más de ${LIMITES_EXTRAS.diario} hs extra en el día.`);
      if (emp.regimen === 'pasantia' && ev.horas > LIMITE_PASANTIA.diario) res.avisos.push(`${iso.slice(8)}/${iso.slice(5, 7)}: la pasantía no puede superar ${LIMITE_PASANTIA.diario} hs diarias (Ley 26.427).`);
      const lunes = toISO(addDays(parseISO(iso), -((ev.dow + 6) % 7)));
      semanas.set(lunes, (semanas.get(lunes) || 0) + ev.horas);
    } else if (ev.t === 'FI') res.faltasInj += 1;
    else if (ev.t === 'FJ') res.faltasJust += 1;
    else if (ev.t === 'SG') res.sinGoce += 1;
    else if (ev.t === 'NL') res.noLab += 1;
    else if (ev.t === 'BH') res.bancoUsado += ev.bancoUsado;
    else if (ev.t === 'L') { res.licencias += 1; const l = days[iso]?.l || 'otra'; lic[l] = (lic[l] || 0) + 1; if (l === 'vacaciones') res.vacaciones += 1; }
    else if (ev.laborable && (!hoy || iso <= hoy)) res.sinRegistrar += 1;
    p = addDays(p, 1);
  }
  res.he50 = r2(res.he50); res.he100 = r2(res.he100); res.hsTrab = r2(res.hsTrab); res.hsNormales = r2(res.hsNormales);
  res.hsFaltantes = r2(res.hsFaltantes); res.hsPactadas = r2(res.hsPactadas); res.bancoGen = r2(res.bancoGen); res.bancoUsado = r2(res.bancoUsado);
  res.licenciasPorTipo = lic;
  if (!emp.bancoHoras && res.he50 + res.he100 > LIMITES_EXTRAS.mensual && desde.slice(0, 7) === hasta.slice(0, 7))
    res.avisos.push(`Total de ${r2(res.he50 + res.he100)} hs extra en el mes: supera el límite habitual de ${LIMITES_EXTRAS.mensual} hs mensuales (Dto. 484/2000).`);
  if (emp.regimen === 'pasantia') semanas.forEach((h, lunes) => { if (h > LIMITE_PASANTIA.semanal) res.avisos.push(`Semana del ${lunes.slice(8)}/${lunes.slice(5, 7)}: ${r2(h)} hs, supera las ${LIMITE_PASANTIA.semanal} hs semanales de la pasantía (Ley 26.427).`); });
  return res;
}

/** Novedades de nómina a partir del resumen de asistencia. */
export function novedadesDesdeResumen(res, { descontarHoras = false } = {}) {
  return { he50: res.he50, he100: res.he100, ausenciasInjustificadas: res.faltasInj, sinGoce: res.sinGoce, feriadosTrabajados: res.feriadosTrab, hsDescontar: descontarHoras ? res.hsFaltantes : 0 };
}

export const nombreMes = (iso) => iso.slice(0, 7);
