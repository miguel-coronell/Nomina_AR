import { parseISO, toUTC, addDays, diffYMD, daysBetween } from '../../../core/dates.js';

/**
 * Antigüedad entre ingreso y egreso (ambos inclusive).
 * `periodos` = años de servicio + 1 si la fracción supera 3 meses (Art. 245).
 */
export function calcAntiguedad(ingresoISO, egresoISO) {
  const s = parseISO(ingresoISO);
  const e = parseISO(egresoISO);
  if (toUTC(e) < toUTC(s)) throw new Error('El egreso no puede ser anterior al ingreso.');
  const { years, months, days } = diffYMD(s, addDays(e, 1));
  const fraccionMayorATresMeses = months > 3 || (months === 3 && days > 0);
  const partes = [];
  if (years) partes.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months) partes.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  if (days || !partes.length) partes.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  return {
    years, months, days,
    periodos: years + (fraccionMayorATresMeses ? 1 : 0),
    totalDias: daysBetween(s, e) + 1,
    texto: partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0],
  };
}

/** ¿La antigüedad supera estrictamente N meses? */
export const superaMeses = (a, n) => {
  const m = a.years * 12 + a.months;
  return m > n || (m === n && a.days > 0);
};
/** ¿La antigüedad supera estrictamente N años? */
export const superaAnios = (a, n) => superaMeses(a, n * 12);
