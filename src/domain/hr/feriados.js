/**
 * FERIADOS Y DÍAS NO LABORABLES (Ley 27.399, Decreto 614/2025).
 * - feriado: no se trabaja; si se trabaja se paga doble (art. 166 LCT).
 * - no_laborable: optativo para el empleador; si se trabaja se paga como un día común.
 * Calendario 2026 verificado con fuentes oficiales/periodísticas (octubre 2026). Para los demás años se calculan solos
 * los feriados nacionales (fijos, trasladables y los de Pascua); los días no laborables o extraordinarios se completan desde el calendario de la app.
 */
export const FERIADOS_2026 = [
  ['2026-01-01', 'Año Nuevo', 'feriado'],
  ['2026-02-16', 'Carnaval', 'feriado'],
  ['2026-02-17', 'Carnaval', 'feriado'],
  ['2026-03-23', 'Día no laborable con fines turísticos', 'no_laborable'],
  ['2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'feriado'],
  ['2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'feriado'],
  ['2026-04-03', 'Viernes Santo', 'feriado'],
  ['2026-05-01', 'Día del Trabajador', 'feriado'],
  ['2026-05-25', 'Día de la Revolución de Mayo', 'feriado'],
  ['2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes (trasladado del 17/06)', 'feriado'],
  ['2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', 'feriado'],
  ['2026-07-09', 'Día de la Independencia', 'feriado'],
  ['2026-07-10', 'Día no laborable con fines turísticos', 'no_laborable'],
  ['2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín', 'feriado'],
  ['2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'feriado'],
  ['2026-11-09', 'Feriado nacional extraordinario por la visita del Papa León XIV', 'feriado'],
  ['2026-11-23', 'Día de la Soberanía Nacional (trasladado del 20/11)', 'feriado'],
  ['2026-12-07', 'Día no laborable con fines turísticos', 'no_laborable'],
  ['2026-12-08', 'Inmaculada Concepción de María', 'feriado'],
  ['2026-12-25', 'Navidad', 'feriado'],
];

/** Feriados de fecha fija (inamovibles). */
const FIJOS = [['01-01', 'Año Nuevo'], ['03-24', 'Día Nacional de la Memoria'], ['04-02', 'Día del Veterano y de los Caídos en Malvinas'],
  ['05-01', 'Día del Trabajador'], ['05-25', 'Día de la Revolución de Mayo'], ['06-20', 'Paso a la Inmortalidad del Gral. Belgrano'],
  ['07-09', 'Día de la Independencia'], ['12-08', 'Inmaculada Concepción de María'], ['12-25', 'Navidad']];

/** Feriados trasladables (Ley 27.399, art. 6): martes/miércoles → lunes anterior; jueves/viernes → lunes siguiente. */
const TRASLADABLES = [[6, 17, 'Paso a la Inmortalidad del Gral. Güemes'], [8, 17, 'Paso a la Inmortalidad del Gral. San Martín'],
  [10, 12, 'Día del Respeto a la Diversidad Cultural'], [11, 20, 'Día de la Soberanía Nacional']];

const isoDe = (d) => d.toISOString().slice(0, 10);
const sumar = (d, n) => { const r = new Date(d.getTime()); r.setUTCDate(r.getUTCDate() + n); return r; };

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function pascua(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, mes - 1, dia, 12));
}

/**
 * Calendario de feriados nacionales calculado para CUALQUIER año: fijos + trasladables (Ley 27.399) + Carnaval y Viernes Santo (según Pascua).
 * No incluye los días no laborables con fines turísticos ni feriados extraordinarios que decrete el Gobierno: agregalos desde el calendario de la app.
 */
export function feriadosCalculados(year) {
  const y = Number(year), map = new Map();
  FIJOS.forEach(([md, nombre]) => map.set(`${y}-${md}`, { nombre, tipo: 'feriado' }));
  TRASLADABLES.forEach(([m, d, nombre]) => {
    const f = new Date(Date.UTC(y, m - 1, d, 12)), dow = f.getUTCDay();
    const mov = dow === 2 || dow === 3 ? sumar(f, -(dow - 1)) : dow === 4 || dow === 5 ? sumar(f, 8 - dow) : f;
    map.set(isoDe(mov), { nombre: mov.getTime() === f.getTime() ? nombre : `${nombre} (trasladado del ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')})`, tipo: 'feriado' });
  });
  const p = pascua(y);
  map.set(isoDe(sumar(p, -48)), { nombre: 'Carnaval', tipo: 'feriado' });
  map.set(isoDe(sumar(p, -47)), { nombre: 'Carnaval', tipo: 'feriado' });
  map.set(isoDe(sumar(p, -2)), { nombre: 'Viernes Santo', tipo: 'feriado' });
  return map;
}

export const TIPOS_FERIADO = { feriado: 'Feriado nacional', no_laborable: 'Día no laborable' };

/**
 * Mapa fecha → { nombre, tipo, custom } del año, aplicando los ajustes del usuario
 * (`ajustes = { custom: [{fecha,nombre,tipo}], removidos: [fecha] }`).
 */
export function feriadosDelAnio(year, ajustes = {}) {
  const map = new Map();
  if (Number(year) === 2026) FERIADOS_2026.forEach(([f, nombre, tipo]) => map.set(f, { nombre, tipo }));
  else feriadosCalculados(year).forEach((v, k) => map.set(k, v));
  (ajustes.removidos || []).forEach((f) => map.delete(f));
  (ajustes.custom || []).filter((c) => String(c.fecha).startsWith(`${year}-`))
    .forEach((c) => map.set(c.fecha, { nombre: c.nombre, tipo: c.tipo === 'no_laborable' ? 'no_laborable' : 'feriado', custom: true }));
  return map;
}

/** Mapa que cubre varios años (para períodos que cruzan fin de año). */
export function feriadosEntre(desde, hasta, ajustes) {
  const out = new Map();
  for (let y = Number(desde.slice(0, 4)); y <= Number(hasta.slice(0, 4)); y++) feriadosDelAnio(y, ajustes).forEach((v, k) => out.set(k, v));
  return out;
}
