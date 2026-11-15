/**
 * MOTOR DE NÓMINA — recibo de haberes de un empleado en un período.
 * Función pura: calcularLinea(snapshot, novedades, periodo, params) → línea.
 */
import { round2, money } from '../../core/format.js';
import { parseISO } from '../../core/dates.js';
import { calcAntiguedad } from '../liquidation/rules/antiguedad.js';
import { factorTrabajado } from './periodos.js';
import { contribucionesEmpleador } from './costo.js';

export const NOVEDADES_VACIAS = { hsNormales: 0, he50: 0, he100: 0, ausenciasInjustificadas: 0, sinGoce: 0, feriadosTrabajados: 0, hsDescontar: 0, bono: 0, noRemunerativo: 0, adelanto: 0, otrosDescuentos: 0, mejorRemuneracion: 0, nota: '' };

const n = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : 0; };
export const normalizarNovedades = (v = {}) => ({
  hsNormales: n(v.hsNormales), he50: n(v.he50), he100: n(v.he100), ausenciasInjustificadas: n(v.ausenciasInjustificadas), sinGoce: n(v.sinGoce), feriadosTrabajados: n(v.feriadosTrabajados), hsDescontar: n(v.hsDescontar), bono: n(v.bono),
  noRemunerativo: n(v.noRemunerativo), adelanto: n(v.adelanto), otrosDescuentos: n(v.otrosDescuentos),
  mejorRemuneracion: n(v.mejorRemuneracion), nota: String(v.nota || '').slice(0, 200),
});

/** Divisor del valor hora: explícito, o proporcional a las horas semanales (48 hs → 200). */
export const divisorHoraDe = (hs, explicito) => (Number(explicito) > 0 ? Number(explicito) : Number(hs) > 0 ? Math.round(((Number(hs) * 25) / 6) * 100) / 100 : 200);

export const snapshotEmpleado = (e) => ({
  sueldo: Number(e.sueldo) || 0, fechaIngreso: e.fechaIngreso, fechaEgreso: e.fechaEgreso || '',
  adicionalAntiguedadPct: Number(e.adicionalAntiguedadPct) || 0, presentismoPct: Number(e.presentismoPct) || 0,
  regimen: e.regimen === 'pasantia' ? 'pasantia' : 'dependencia', horasSemanales: Number(e.horasSemanales) || 0,
  divisorHora: divisorHoraDe(e.horasSemanales, e.divisorHora),
  modalidad: e.modalidad === 'hora' ? 'hora' : 'mensual', valorHora: Number(e.valorHora) || 0, afiliado: !!e.afiliado,
});

/** Las contribuciones de un pasante se limitan a obra social y ART (Ley 26.427 y Dto. 491/96). */
export const patronalesDe = (snap, params) => (snap.regimen === 'pasantia'
  ? Object.fromEntries(['obraSocial', 'art'].map((k) => [k, (params.patronales || {})[k] || 0]))
  : (params.patronales || {}));

export const totalPatronal = (pat = {}) => Object.values(pat).reduce((a, v) => a + (Number(v) || 0), 0);

export function calcularLinea(snap, novedadesRaw, p, params) {
  const nov = normalizarNovedades(novedadesRaw);
  const { factor, dias, diasPeriodo } = factorTrabajado(snap, p);
  const warnings = [];
  const rubros = [];
  const add = (id, label, amount, tipo = 'remunerativo', meta = {}) => { if (amount > 0) rubros.push({ id, label, amount: round2(amount), tipo, ...meta }); };

  const finAnt = snap.fechaEgreso && snap.fechaEgreso < p.hasta ? snap.fechaEgreso : p.hasta;
  const anios = snap.fechaIngreso <= finAnt ? calcAntiguedad(snap.fechaIngreso, finAnt).years : 0;
  const antigMensualPct = snap.adicionalAntiguedadPct * anios; // % acumulado
  const porHora = snap.modalidad === 'hora' && snap.regimen !== 'pasantia' && p.tipo !== 'sac';
  const remMensual = porHora ? 0 : snap.sueldo * (1 + antigMensualPct / 100);
  const parcial = !porHora && factor < 1;
  if (porHora) { if (!(snap.valorHora > 0)) warnings.push('Falta el valor hora: cargalo en la ficha o elegí convenio y categoría.'); if (!(nov.hsNormales > 0)) warnings.push('Cargá las horas trabajadas del período.'); }
  else if (factor === 0) warnings.push('Sin días trabajados en el período.');
  else if (parcial) warnings.push(`Proporcional: ${dias} de ${diasPeriodo} días del período.`);

  const pasante = snap.regimen === 'pasantia';
  const vh = porHora ? snap.valorHora : remMensual / (snap.divisorHora || 200);
  let ausenciasDesc = 0, sinGocePesos = 0, hsDescPesos = 0;

  if (pasante) {
    add('asignacion', `Asignación estímulo - pasantía educativa${parcial ? ` (${dias}/${diasPeriodo} días)` : ''}`, snap.sueldo * factor, 'no_remunerativo',
      { cant: parcial ? dias : 30, unidad: 'días', base: round2(snap.sueldo) });
  } else if (porHora) {
    const base = nov.hsNormales * vh;
    add('basico', 'Básico horas normales', base, 'remunerativo', { cant: nov.hsNormales, unidad: 'hs', base: round2(vh) });
    if (snap.presentismoPct > 0) {
      if (nov.ausenciasInjustificadas > 0 || nov.sinGoce > 0) warnings.push('Presentismo perdido por ausencias injustificadas o licencia sin goce.');
      else add('presentismo', `Presentismo (${snap.presentismoPct}%)`, base * (snap.presentismoPct / 100), 'remunerativo', { cant: snap.presentismoPct, unidad: '%', base: round2(base) });
    }
    add('he50', `Horas extras 50% (${nov.he50} hs)`, nov.he50 * vh * 1.5, 'remunerativo', { cant: nov.he50, unidad: 'hs', base: round2(vh * 1.5) });
    add('he100', `Horas extras 100% (${nov.he100} hs)`, nov.he100 * vh * 2, 'remunerativo', { cant: nov.he100, unidad: 'hs', base: round2(vh * 2) });
    add('feriado', `Feriado trabajado - día adicional (${nov.feriadosTrabajados} ${nov.feriadosTrabajados === 1 ? 'día' : 'días'})`, nov.feriadosTrabajados * vh * 8, 'remunerativo', { cant: nov.feriadosTrabajados, unidad: 'días', base: round2(vh * 8) });
    add('bono', 'Adicional / bono remunerativo', nov.bono);
    add('no_rem', 'Adicional no remunerativo', nov.noRemunerativo, 'no_remunerativo');
    hsDescPesos = round2(vh * nov.hsDescontar);
  } else if (p.tipo === 'sac') {
    let mejor = nov.mejorRemuneracion || remMensual;
    if (!nov.mejorRemuneracion && snap.presentismoPct > 0) mejor *= 1 + snap.presentismoPct / 100;
    add('sac', `SAC ${p.semestre === 1 ? '1.er' : '2.º'} semestre${parcial ? ` (proporcional ${dias}/${diasPeriodo})` : ''}`, (mejor / 2) * factor, 'remunerativo', { cant: 50, unidad: '%', base: round2(mejor) });
  } else {
    const base = (p.tipo === 'quincenal' ? snap.sueldo / 2 : snap.sueldo) * factor;
    const antig = base * (antigMensualPct / 100);
    add('basico', `Sueldo básico${p.tipo === 'quincenal' ? ' (quincena)' : ''}${parcial ? ` — ${dias}/${diasPeriodo} días` : ''}`, base, 'remunerativo', { cant: parcial ? dias : (p.tipo === 'quincenal' ? 15 : 30), unidad: 'días', base: round2(snap.sueldo) });
    add('antiguedad', `Adicional por antigüedad (${anios} ${anios === 1 ? 'año' : 'años'} × ${snap.adicionalAntiguedadPct}%)`, antig, 'remunerativo', { cant: round2(antigMensualPct), unidad: '%', base: round2(base) });
    const pierdePres = nov.ausenciasInjustificadas > 0 || nov.sinGoce > 0;
    if (snap.presentismoPct > 0) {
      if (pierdePres) warnings.push('Presentismo perdido por ausencias injustificadas o licencia sin goce.');
      else add('presentismo', `Presentismo (${snap.presentismoPct}%)`, (base + antig) * (snap.presentismoPct / 100), 'remunerativo', { cant: snap.presentismoPct, unidad: '%', base: round2(base + antig) });
    }
    add('he50', `Horas extras 50% (${nov.he50} hs)`, nov.he50 * vh * 1.5, 'remunerativo', { cant: nov.he50, unidad: 'hs', base: round2(vh * 1.5) });
    add('he100', `Horas extras 100% (${nov.he100} hs)`, nov.he100 * vh * 2, 'remunerativo', { cant: nov.he100, unidad: 'hs', base: round2(vh * 2) });
    const divF = Number(params.divisorFeriado) || 25;
    add('feriado', `Feriado trabajado - día adicional (art. 166 LCT) (${nov.feriadosTrabajados} ${nov.feriadosTrabajados === 1 ? 'día' : 'días'})`, nov.feriadosTrabajados * (remMensual / divF), 'remunerativo', { cant: nov.feriadosTrabajados, unidad: 'días', base: round2(remMensual / divF) });
    add('bono', 'Adicional / bono remunerativo', nov.bono);
    add('no_rem', 'Adicional no remunerativo', nov.noRemunerativo, 'no_remunerativo');
    ausenciasDesc = round2((remMensual / 30) * nov.ausenciasInjustificadas);
    sinGocePesos = round2((remMensual / 30) * nov.sinGoce);
    hsDescPesos = round2(vh * nov.hsDescontar);
  }

  const remunerativo = round2(rubros.filter((r) => r.tipo === 'remunerativo').reduce((a, r) => a + r.amount, 0));
  const noRemunerativo = round2(rubros.filter((r) => r.tipo === 'no_remunerativo').reduce((a, r) => a + r.amount, 0));
  const reduccionBase = round2(ausenciasDesc + sinGocePesos + hsDescPesos);
  const baseAportesBruta = pasante ? noRemunerativo : Math.max(0, remunerativo - reduccionBase);
  const topeMes = Number(params.topeRemunerativo) || 0;
  const tope = topeMes > 0 ? (p.tipo === 'quincenal' ? topeMes / 2 : topeMes) : 0;
  const baseAportes = round2(tope > 0 ? Math.min(baseAportesBruta, tope) : baseAportesBruta);

  const deducciones = [];
  const ded = (id, label, amount, pct, meta = {}) => { if (amount > 0) deducciones.push({ id, label, amount: round2(amount), ...(pct != null ? { pct, base: baseAportes } : {}), ...meta }); };
  ded('ausencias', `Ausencias injustificadas (${nov.ausenciasInjustificadas} ${nov.ausenciasInjustificadas === 1 ? 'día' : 'días'})`, ausenciasDesc, null, { cant: nov.ausenciasInjustificadas, unidad: 'días', base: round2(remMensual / 30) });
  ded('sin_goce', `Licencia sin goce de haberes (${nov.sinGoce} ${nov.sinGoce === 1 ? 'día' : 'días'})`, sinGocePesos, null, { cant: nov.sinGoce, unidad: 'días', base: round2(remMensual / 30) });
  ded('hs_desc', `Horas no trabajadas (${nov.hsDescontar} hs)`, hsDescPesos, null, { cant: nov.hsDescontar, unidad: 'hs', base: round2(vh) });
  const a = params.aportes || {};
  const j = params.jornal || {};
  if (!pasante) [['jubilacion', 'Jubilación (SIPA)'], ['pami', 'Ley 19.032 (INSSJP)'], ['obraSocial', 'Obra social'], ...(porHora ? [] : [['sindicato', 'Cuota sindical']])]
    .forEach(([k, l]) => ded(`ap_${k}`, l, baseAportes * ((Number(a[k]) || 0) / 100), Number(a[k]) || 0));
  if (porHora && baseAportes > 0) {
    ded('os_adic', 'Obra social adicional jornalero', baseAportes * ((Number(j.osAdicPct) || 0) / 100), Number(j.osAdicPct) || 0);
    if (snap.afiliado) ded('sindicato', 'Cuota sindical afiliados', baseAportes * ((Number(j.sindicatoPct) || 0) / 100), Number(j.sindicatoPct) || 0);
    ded('seguro_vida', 'Seguro de vida', Number(j.seguroVida) || 0);
  }
  ded('adelanto', 'Adelanto / anticipo de sueldo', nov.adelanto);
  ded('otros', 'Otros descuentos', nov.otrosDescuentos);

  const descuentos = round2(deducciones.reduce((s, d) => s + d.amount, 0));
  if (porHora && j.redondeo !== false) {
    const previo = round2(remunerativo + noRemunerativo - descuentos);
    const red = round2(Math.ceil(previo - 1e-9) - previo);
    if (red > 0) rubros.push({ id: 'redondeo', label: 'Redondeo', amount: red, tipo: 'no_remunerativo' });
  }
  const noRemTot = round2(rubros.filter((r) => r.tipo === 'no_remunerativo').reduce((a, r) => a + r.amount, 0));
  const bruto = round2(remunerativo + noRemTot);
  const neto = round2(bruto - descuentos);
  if (neto < 0) warnings.push(`El neto es negativo (${money(neto)}): revisá adelantos y descuentos.`);
  const patronal = round2(contribucionesEmpleador(baseAportes, patronalesDe(snap, params)).reduce((x, c) => x + c.monto, 0));

  return {
    rubros, deducciones, warnings,
    totals: { bruto, remunerativo, noRemunerativo: noRemTot, descuentos, neto, patronal, costo: round2(bruto - reduccionBase + patronal), ausencias: reduccionBase, baseAportes },
  };
}
