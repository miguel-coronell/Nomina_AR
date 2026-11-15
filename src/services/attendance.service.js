/**
 * Registro de asistencia. Se guarda un documento por mes ("att-AAAA-MM") con todos los empleados:
 *   { emps: { [employeeId]: { 'YYYY-MM-DD': { t, h?, l?, rec?, n? } } } }
 * Así listar un mes completo cuesta una sola lectura.
 */
import { horaActual, turnoAbierto, aMinutos } from '../domain/hr/horas.js';

const key = (y, m) => `att-${y}-${String(m).padStart(2, '0')}`;

/** Quita campos vacíos para que el documento sea liviano. */
const limpiar = (rec) => {
  const out = { t: rec.t };
  if (rec.h !== undefined && rec.h !== '' && rec.h !== null) out.h = Number(rec.h) || 0;
  const iv = Array.isArray(rec.i) ? rec.i.filter((p) => /^\d{1,2}:\d{2}$/.test(String(p?.[0] ?? ''))) : [];
  if (iv.length) out.i = iv.map(([e, x]) => [String(e), x ? String(x) : null]);
  if (rec.d !== undefined && rec.d !== '' && rec.d !== null) out.d = Number(rec.d) || 0;
  if (rec.l) out.l = rec.l;
  if (rec.rec) out.rec = rec.rec;
  if (rec.n) out.n = String(rec.n).slice(0, 120);
  return out;
};

const err = (code, message) => Object.assign(new Error(message || code), { code });
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function createAttendanceService(repo) {
  const readMonth = async (y, m) => (await repo.getDoc(key(y, m)))?.emps || {};
  const getDay = async (d, empId) => { const emps = await readMonth(d.getFullYear(), d.getMonth() + 1); return { emps, days: emps[empId] || {}, iso: isoLocal(d) }; };

  const service = {
    getMonth: readMonth,

    /** Registros de un empleado en un mes: { 'YYYY-MM-DD': registro } */
    async getEmployeeMonth(y, m, empId) { return (await readMonth(y, m))[empId] || {}; },

    async saveEmployeeMonth(y, m, empId, days) {
      const emps = await readMonth(y, m);
      const clean = Object.fromEntries(Object.entries(days).filter(([, r]) => r && r.t).map(([f, r]) => [f, limpiar(r)]));
      if (Object.keys(clean).length) emps[empId] = clean; else delete emps[empId];
      await repo.setDoc(key(y, m), { emps, updatedAt: new Date().toISOString() });
    },

    /** Mapa empleado → días, uniendo los meses que abarca el rango (para quincenas o cambios de mes). */
    async getRange(desde, hasta) {
      const out = {};
      let y = Number(desde.slice(0, 4)), m = Number(desde.slice(5, 7));
      const fin = hasta.slice(0, 7);
      while (`${y}-${String(m).padStart(2, '0')}` <= fin) {
        const emps = await readMonth(y, m);
        for (const [id, days] of Object.entries(emps)) out[id] = { ...(out[id] || {}), ...days };
        m += 1; if (m > 12) { m = 1; y += 1; }
      }
      return out;
    },

    /** Los 12 meses de un año para un empleado (vacaciones, banco de horas, resumen anual). */
    async getEmployeeYear(y, empId) {
      const meses = await Promise.all(Array.from({ length: 12 }, (_, i) => readMonth(y, i + 1)));
      return meses.map((emps) => emps[empId] || {});
    },
  };

  /**
   * FICHAJE: registra la entrada o la salida del momento `now`. Si hay un turno abierto lo cierra (salida);
   * si no, abre uno nuevo (entrada). Un turno nocturno abierto ayer se cierra hoy.
   */
  service.punch = async (empId, now = new Date()) => {
    const hora = horaActual(now);
    const hoy = await getDay(now, empId);
    let rec = hoy.days[hoy.iso];
    if (rec && rec.t !== 'T') throw err('OTRO_REGISTRO', 'Hoy ya figura una falta, licencia o descanso cargado para esta persona.');
    if (rec && !(rec.i || []).length && rec.h) throw err('HORAS_MANUALES', 'Hoy ya hay horas cargadas a mano. Corregilas desde Asistencia.');

    // ¿turno nocturno abierto desde ayer?
    if (!rec) {
      const ayer = await getDay(new Date(now.getTime() - 86400000), empId);
      const r = ayer.days[ayer.iso];
      if (r?.t === 'T' && turnoAbierto(r)) {
        const ini = aMinutos(r.i[r.i.length - 1][0]);
        const transcurrido = (24 * 60 - ini) + aMinutos(hora);
        if (transcurrido < 16 * 60) {
          const d = new Date(now.getTime() - 86400000);
          const copia = { ...r, i: r.i.map((x) => [...x]) };
          copia.i[copia.i.length - 1][1] = hora;
          ayer.days[ayer.iso] = copia;
          await service.saveEmployeeMonth(d.getFullYear(), d.getMonth() + 1, empId, ayer.days);
          return { tipo: 'salida', hora, iso: ayer.iso, rec: copia, nocturno: true };
        }
      }
    }
    rec = { ...(rec || { t: 'T' }), t: 'T', i: (rec?.i || []).map((x) => [...x]) };
    delete rec.h;
    const ultimo = rec.i[rec.i.length - 1];
    let tipo;
    if (ultimo && !ultimo[1]) {
      if (ultimo[0] === hora) throw err('DOBLE', 'Ya hay una marcación en este mismo minuto.');
      ultimo[1] = hora; tipo = 'salida';
    } else {
      if (ultimo && ultimo[1] === hora) throw err('DOBLE', 'Ya hay una marcación en este mismo minuto.');
      rec.i.push([hora, null]); tipo = 'entrada';
    }
    hoy.days[hoy.iso] = rec;
    await service.saveEmployeeMonth(now.getFullYear(), now.getMonth() + 1, empId, hoy.days);
    return { tipo, hora, iso: hoy.iso, rec };
  };

  /** Personas con un turno abierto hoy (o ayer, en turnos nocturnos) y marcaciones del día. */
  service.hoy = async (now = new Date()) => {
    const [a, b] = await Promise.all([readMonth(now.getFullYear(), now.getMonth() + 1), (async () => { const d = new Date(now.getTime() - 86400000); return { iso: isoLocal(d), emps: await readMonth(d.getFullYear(), d.getMonth() + 1) }; })()]);
    const iso = isoLocal(now);
    const out = {};
    for (const [id, days] of Object.entries(a)) if (days[iso]) out[id] = { iso, rec: days[iso] };
    for (const [id, days] of Object.entries(b.emps)) if (days[b.iso] && turnoAbierto(days[b.iso]) && !out[id]) out[id] = { iso: b.iso, rec: days[b.iso], nocturno: true };
    return out;
  };

  return service;
}