/** Vacaciones anuales (arts. 150 a 157 LCT). Días corridos; el fraccionamiento mínimo es de 7 días (Ley 27.802). */
import { daysBetween, parseISO } from '../../core/dates.js';
import { calcAntiguedad, superaAnios } from '../liquidation/rules/antiguedad.js';

/** Días que corresponden en el año: 14/21/28/35 según antigüedad al 31/12; proporcional si trabajó menos de la mitad de los días hábiles. */
export function diasVacaciones(fechaIngreso, year) {
  const fin = `${year}-12-31`;
  if (!fechaIngreso || fechaIngreso > fin) return 0;
  if (fechaIngreso > `${year}-01-01`) {
    const habiles = ((daysBetween(parseISO(fechaIngreso), parseISO(fin)) + 1) * 5) / 7;
    if (habiles < 130) return Math.ceil(habiles / 20);   // art. 151: 1 día cada 20 de trabajo efectivo (se redondea al alza)
  }
  const a = calcAntiguedad(fechaIngreso, fin);
  if (superaAnios(a, 20)) return 35;
  if (superaAnios(a, 10)) return 28;
  if (superaAnios(a, 5)) return 21;
  return 14;
}

/** `registros` = lista de objetos { 'YYYY-MM-DD': registro } (uno por mes del año). */
export function saldoVacaciones(emp, year, registros = []) {
  const correspondientes = emp.regimen === 'pasantia' ? 0 : diasVacaciones(emp.fechaIngreso, year);
  const tomadas = registros.reduce((a, days) => a + Object.entries(days || {}).filter(([f, r]) => f.startsWith(`${year}-`) && r.t === 'L' && r.l === 'vacaciones').length, 0);
  return { correspondientes, tomadas, saldo: correspondientes - tomadas };
}
