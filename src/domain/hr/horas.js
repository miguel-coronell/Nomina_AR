/**
 * Horas trabajadas a partir de marcaciones de entrada y salida.
 * Un día puede tener varios turnos (turno cortado): rec.i = [['08:00','12:00'], ['13:00', null]]
 * La salida null es un turno abierto (el empleado todavía no marcó la salida).
 */
const r2 = (x) => Math.round(x * 100) / 100;

export const aMinutos = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
};
export const aHHMM = (min) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((min % 60) + 60) % 60).padStart(2, '0')}`;
export const horaActual = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Minutos entre entrada y salida; si la salida es "anterior" se asume que cruza la medianoche. */
export function duracionMin(e, s) {
  const a = aMinutos(e), b = aMinutos(s);
  if (a === null || b === null) return null;
  const d = b - a;
  return d < 0 ? d + 1440 : d;
}

export const intervalos = (rec) => (Array.isArray(rec?.i) ? rec.i.filter((x) => Array.isArray(x) && aMinutos(x[0]) !== null) : []);
export const turnoAbierto = (rec) => { const iv = intervalos(rec); return iv.length > 0 && !iv[iv.length - 1][1]; };

/**
 * Horas del día. Con marcaciones: suma de los turnos cerrados, menos el descanso no remunerado
 * (solo si hay un único turno; con turno cortado el descanso es el hueco entre turnos).
 * Sin marcaciones: las horas cargadas a mano (rec.h).
 */
export function horasDe(rec, descansoMin = 0) {
  if (!rec) return 0;
  const iv = intervalos(rec);
  if (iv.length) {
    const cerrados = iv.map(([e, s]) => duracionMin(e, s)).filter((d) => d !== null);
    let total = cerrados.reduce((a, b) => a + b, 0);
    const desc = Number(rec.d ?? descansoMin) || 0;
    if (cerrados.length === 1 && iv.length === 1 && total > desc) total -= desc;
    return r2(total / 60);
  }
  const n = parseFloat(String(rec.h ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Texto "08:02 → 12:00 · 13:01 → …" para mostrar las marcaciones. */
export const marcacionesTexto = (rec) => intervalos(rec).map(([e, s]) => `${e} → ${s || '…'}`).join(' · ');
