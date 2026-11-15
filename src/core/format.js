const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

export const money = (n) => ars.format(Number.isFinite(+n) ? +n : 0);
export const number = (n) => num.format(Number.isFinite(+n) ? +n : 0);
export const percent = (n) => `${pct.format(+n || 0)}%`;
export const round2 = (n) => Math.round((+n + Number.EPSILON) * 100) / 100;

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (sin pasar por Date para evitar desfasajes de zona horaria). */
export function dateAR(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const dateTimeAR = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(+d) ? '—' : d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || 'U';

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const mesNombre = (m) => MESES[(m - 1 + 12) % 12];

/** Importe abreviado para ejes y gráficos: 1.250.000 → "$ 1,3 M"; 85.000 → "$ 85 mil". */
export const moneyCompact = (n) => {
  const v = Math.abs(+n) || 0, sign = +n < 0 ? '-' : '';
  const f = (x) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: x < 10 ? 1 : 0 }).format(x);
  if (v >= 1e9) return `${sign}$ ${f(v / 1e9)} MM`;
  if (v >= 1e6) return `${sign}$ ${f(v / 1e6)} M`;
  if (v >= 1e3) return `${sign}$ ${f(v / 1e3)} mil`;
  return `${sign}$ ${f(v)}`;
};
