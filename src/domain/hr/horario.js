/** Jornada pactada por día de la semana (0 = domingo … 6 = sábado). */
import { parseISO, toUTC } from '../../core/dates.js';

export const DIAS = [[1, 'Lunes', 'Lun'], [2, 'Martes', 'Mar'], [3, 'Miércoles', 'Mié'], [4, 'Jueves', 'Jue'], [5, 'Viernes', 'Vie'], [6, 'Sábado', 'Sáb'], [0, 'Domingo', 'Dom']];
export const HORARIO_DEFAULT = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 0, 0: 0 };

export const dowOf = (iso) => new Date(toUTC(parseISO(iso))).getUTCDay();
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.min(24, Math.round(n * 100) / 100) : 0; };

/** Normaliza a { '0'..'6': horas }. Sin datos → lunes a viernes 8 hs. */
export function normalizarHorario(h) {
  const base = h && typeof h === 'object' && Object.keys(h).length ? h : HORARIO_DEFAULT;
  return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, num(base[d] ?? base[String(d)])]));
}
export const horasPactadas = (horario, iso) => normalizarHorario(horario)[dowOf(iso)] || 0;
export const horasSemanales = (horario) => Math.round(Object.values(normalizarHorario(horario)).reduce((a, b) => a + b, 0) * 100) / 100;
export const maxDiaria = (horario) => Math.max(...Object.values(normalizarHorario(horario)));
export const horarioTexto = (horario) => {
  const h = normalizarHorario(horario);
  return DIAS.filter(([d]) => h[d] > 0).map(([d, , c]) => `${c} ${h[d]} h`).join(' · ') || 'Sin días laborables';
};

/**
 * Divisor para el valor de la hora: 200 para 48 hs semanales (art. 201 LCT, práctica habitual);
 * proporcional (hs semanales × 25 / 6) para otras jornadas. Un divisor explícito tiene prioridad.
 */
export function divisorHoraDe(horario, explicito) {
  if (Number(explicito) > 0) return Number(explicito);
  const s = horasSemanales(horario);
  return s > 0 ? Math.round(((s * 25) / 6) * 100) / 100 : 200;
}
