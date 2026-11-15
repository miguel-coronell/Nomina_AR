/**
 * FERIADOS Y DÍAS NO LABORABLES (Ley 27.399, Decreto 614/2025).
 * - feriado: no se trabaja; si se trabaja se paga doble (art. 166 LCT).
 * - no_laborable: optativo para el empleador; si se trabaja se paga como un día común.
 * Calendario 2026 verificado con fuentes oficiales/periodísticas (octubre 2026). Para otros años
 * se precargan solo los feriados de fecha fija: completá el resto desde el calendario de la app.
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

/** Feriados de fecha fija (válidos para cualquier año). */
const FIJOS = [['01-01', 'Año Nuevo'], ['03-24', 'Día Nacional de la Memoria'], ['04-02', 'Día del Veterano y de los Caídos en Malvinas'],
  ['05-01', 'Día del Trabajador'], ['05-25', 'Día de la Revolución de Mayo'], ['06-20', 'Día de la Bandera (Belgrano)'],
  ['07-09', 'Día de la Independencia'], ['12-08', 'Inmaculada Concepción de María'], ['12-25', 'Navidad']];

export const TIPOS_FERIADO = { feriado: 'Feriado nacional', no_laborable: 'Día no laborable' };

/**
 * Mapa fecha → { nombre, tipo, custom } del año, aplicando los ajustes del usuario
 * (`ajustes = { custom: [{fecha,nombre,tipo}], removidos: [fecha] }`).
 */
export function feriadosDelAnio(year, ajustes = {}) {
  const map = new Map();
  if (Number(year) === 2026) FERIADOS_2026.forEach(([f, nombre, tipo]) => map.set(f, { nombre, tipo }));
  else FIJOS.forEach(([md, nombre]) => map.set(`${year}-${md}`, { nombre, tipo: 'feriado' }));
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
