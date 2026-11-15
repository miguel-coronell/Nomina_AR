/**
 * Utilidades de fechas puras (sin zona horaria). Trabajan con 'YYYY-MM-DD'.
 * Usadas por el motor de liquidación y la UI.
 */
export const isValidISO = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseISO(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
};

export const parseISO = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return { y, m, d };
};

export const toISO = ({ y, m, d }) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const toUTC = ({ y, m, d }) => Date.UTC(y, m - 1, d);

/** m es 1-12 */
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

export const addDays = (p, n) => {
  const dt = new Date(toUTC(p) + n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};

export const maxDate = (a, b) => (toUTC(a) >= toUTC(b) ? a : b);

/** Diferencia calendario entre start y endExclusive en años/meses/días. */
export function diffYMD(start, endExclusive) {
  let years = endExclusive.y - start.y;
  let months = endExclusive.m - start.m;
  let days = endExclusive.d - start.d;
  if (days < 0) {
    months -= 1;
    const prevM = endExclusive.m === 1 ? 12 : endExclusive.m - 1;
    const prevY = endExclusive.m === 1 ? endExclusive.y - 1 : endExclusive.y;
    days += daysInMonth(prevY, prevM);
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

/** Suma N días hábiles (lun-vie) a una fecha ISO. No considera feriados. */
export function addBusinessDays(iso, n) {
  let p = parseISO(iso), left = n;
  while (left > 0) {
    p = addDays(p, 1);
    const dow = new Date(toUTC(p)).getUTCDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return toISO(p);
}
