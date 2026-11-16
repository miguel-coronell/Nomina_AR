/**
 * Firma de recibos (empleador / empleado): trazo dibujado en el tablero + fecha y hora.
 * Se guarda por recibo en este dispositivo: { at, img (PNG), w, h }.
 */
const K = 'nominaar.firmas';
const key = (run, l) => `${run.id || run.label || 'run'}:${l.employeeId}`;
const all = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch { return {}; } };
const norm = (v) => (typeof v === 'string' ? { at: v } : v || undefined); // compatibilidad con firmas guardadas como fecha

export function getFirmas(run, l) {
  const f = all()[key(run, l)] || {};
  return { empleador: norm(f.empleador), empleado: norm(f.empleado) };
}

/** `sig` = { img, w, h } para firmar; null para quitar la firma. */
export function setFirma(run, l, parte, sig) {
  const a = all(), k = key(run, l);
  a[k] = { ...a[k] };
  if (sig) a[k][parte] = { at: new Date().toISOString(), ...sig }; else delete a[k][parte];
  try { localStorage.setItem(K, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
  return getFirmas(run, l);
}

export function fmtFirma(v) {
  const iso = typeof v === 'string' ? v : v?.at;
  if (!iso) return '';
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
