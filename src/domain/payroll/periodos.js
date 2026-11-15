import { daysInMonth, daysBetween, parseISO, toUTC } from '../../core/dates.js';
import { mesNombre } from '../../core/format.js';

export const TIPOS_NOMINA = [
  { id: 'mensual', label: 'Mensual' },
  { id: 'quincenal', label: 'Quincenal' },
  { id: 'sac', label: 'SAC (aguinaldo)' },
];
export const tipoLabel = (id) => TIPOS_NOMINA.find((t) => t.id === id)?.label || id;

/** Describe un período: fechas, etiqueta y clave única (para evitar duplicados). */
export function describirPeriodo({ tipo, year, month = 1, quincena = 1, semestre = 1 }) {
  const y = Number(year), m = Number(month);
  if (tipo === 'sac') {
    const s = Number(semestre) === 2 ? 2 : 1;
    return { tipo, year: y, semestre: s, desde: `${y}-${s === 1 ? '01-01' : '07-01'}`, hasta: `${y}-${s === 1 ? '06-30' : '12-31'}`,
      label: `SAC ${s === 1 ? '1.er' : '2.º'} semestre ${y}`, clave: `${y}-S${s}-sac` };
  }
  const last = daysInMonth(y, m);
  const pad = (n) => String(n).padStart(2, '0');
  if (tipo === 'quincenal') {
    const q = Number(quincena) === 2 ? 2 : 1;
    return { tipo, year: y, month: m, quincena: q, desde: `${y}-${pad(m)}-${q === 1 ? '01' : '16'}`, hasta: `${y}-${pad(m)}-${q === 1 ? '15' : pad(last)}`,
      label: `${q}.ª quincena de ${mesNombre(m)} ${y}`, clave: `${y}-${pad(m)}-Q${q}` };
  }
  return { tipo: 'mensual', year: y, month: m, desde: `${y}-${pad(m)}-01`, hasta: `${y}-${pad(m)}-${pad(last)}`, label: `${mesNombre(m)} ${y}`, clave: `${y}-${pad(m)}` };
}

/** ¿El empleado tuvo relación vigente en algún día del período? */
export function elegible(emp, p) {
  if (!emp.fechaIngreso || emp.fechaIngreso > p.hasta) return false;
  return !emp.fechaEgreso || emp.fechaEgreso >= p.desde;
}

/** Mensuales van a nómina mensual, quincenales a quincenal; el SAC incluye a todos. */
export const incluirEn = (emp, tipo) => (tipo === 'sac' ? emp.regimen !== 'pasantia' : (emp.periodicidad || 'mensual') === tipo);

/** Proporción del período efectivamente trabajada (0..1). */
export function factorTrabajado(snap, p) {
  const start = snap.fechaIngreso > p.desde ? snap.fechaIngreso : p.desde;
  const end = snap.fechaEgreso && snap.fechaEgreso < p.hasta ? snap.fechaEgreso : p.hasta;
  if (toUTC(parseISO(end)) < toUTC(parseISO(start))) return { factor: 0, dias: 0, diasPeriodo: daysBetween(parseISO(p.desde), parseISO(p.hasta)) + 1 };
  const dias = daysBetween(parseISO(start), parseISO(end)) + 1;
  const diasPeriodo = daysBetween(parseISO(p.desde), parseISO(p.hasta)) + 1;
  return { factor: dias / diasPeriodo, dias, diasPeriodo, start, end };
}
