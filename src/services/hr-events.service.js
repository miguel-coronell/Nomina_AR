/** Registro cronológico de novedades de RR.HH. por empleado (legajo): sanciones, capacitaciones, exámenes, etc. */
const COL = 'hrEvents';

export const TIPOS_EVENTO = [
  ['apercibimiento', 'Apercibimiento / sanción', 'fa-triangle-exclamation'],
  ['suspension', 'Suspensión', 'fa-ban'],
  ['capacitacion', 'Capacitación', 'fa-graduation-cap'],
  ['examen_medico', 'Examen médico / apto', 'fa-notes-medical'],
  ['accidente', 'Accidente / enfermedad profesional', 'fa-kit-medical'],
  ['cambio_categoria', 'Cambio de categoría / puesto', 'fa-arrows-up-down'],
  ['aumento', 'Aumento salarial', 'fa-arrow-trend-up'],
  ['documentacion', 'Documentación entregada / pendiente', 'fa-folder-open'],
  ['evaluacion', 'Evaluación de desempeño', 'fa-clipboard-check'],
  ['otro', 'Otro', 'fa-note-sticky'],
];
export const tipoEvento = (id) => TIPOS_EVENTO.find((t) => t[0] === id) || TIPOS_EVENTO.at(-1);

export function validateEvent(e) {
  const errors = {};
  if (!e.employeeId) errors.employeeId = 'Elegí un empleado.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha || '')) errors.fecha = 'Ingresá la fecha.';
  if (!(e.titulo || '').trim()) errors.titulo = 'Ingresá un título.';
  if (e.vencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(e.vencimiento)) errors.vencimiento = 'Fecha inválida.';
  return errors;
}

export function createHrEventsService(repo) {
  return {
    list: () => repo.list(COL),
    async listFor(employeeId) { return (await repo.list(COL)).filter((e) => e.employeeId === employeeId).sort((a, b) => b.fecha.localeCompare(a.fecha)); },
    async save(data) {
      const errors = validateEvent(data);
      if (Object.keys(errors).length) throw Object.assign(new Error('VALIDATION'), { errors });
      const payload = { employeeId: data.employeeId, fecha: data.fecha, tipo: data.tipo || 'otro', titulo: data.titulo.trim().slice(0, 120), detalle: (data.detalle || '').trim().slice(0, 1000), vencimiento: data.vencimiento || '' };
      return data.id ? repo.update(COL, data.id, payload) : repo.create(COL, payload);
    },
    remove: (id) => repo.remove(COL, id),
  };
}
