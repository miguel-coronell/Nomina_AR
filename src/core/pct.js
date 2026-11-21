/**
 * Porcentaje de una ficha (presentismo, antigüedad). Excel guarda «20%» como 0,2: un valor entre 0 y 1 se toma como fracción
 * (0,2 → 20 · 0,0833 → 8,33). Un presentismo o una antigüedad menores a 1 % no existen en la práctica, así que no hay ambigüedad.
 */
export const pctFicha = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace('%', '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return n > 0 && n < 1 ? Math.round(n * 100 * 10000) / 10000 : n;
};
