import { ZONAS, vigenciaEscala, esJornalizadoPorEscala } from '../domain/convenios/escalas.js';
import { pctFicha } from '../core/pct.js';
import { isValidISO, toUTC, parseISO, daysBetween } from '../core/dates.js';

const COL = 'employees';

export const CONTRATOS = [
  ['indeterminado', 'Tiempo indeterminado'],
  ['plazo_fijo', 'Plazo fijo'],
  ['eventual', 'Eventual'],
  ['temporada', 'De temporada'],
  ['pasantia', 'Pasantía'],
];
export const JORNADAS = [['completa', 'Completa'], ['parcial', 'Parcial'], ['reducida', 'Reducida']];
export const REGIMENES = [['dependencia', 'Relación de dependencia'], ['pasantia', 'Pasantía educativa (Ley 26.427)']];
export const PERIODICIDADES = [['mensual', 'Mensual'], ['quincenal', 'Quincenal']];

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const pct = pctFicha;

/** Limpia y tipa los datos de un empleado (sin validar). */
export function normalizeEmployee(d) {
  const e = {
    nombre: String(d.nombre || '').trim().replace(/\s+/g, ' '),
    dni: digits(d.dni),
    cuil: digits(d.cuil),
    legajo: String(d.legajo || '').trim(),
    fechaIngreso: d.fechaIngreso || '',
    fechaEgreso: d.fechaEgreso || '',
    tipoContrato: d.tipoContrato || 'indeterminado',
    convenio: String(d.convenio || '').trim(),
    categoria: String(d.categoria || '').trim(),
    jornada: d.jornada || 'completa',
    periodicidad: d.periodicidad === 'quincenal' ? 'quincenal' : 'mensual',
    sueldo: Number(d.sueldo) || 0,
    adicionalAntiguedadPct: pct(d.adicionalAntiguedadPct),
    presentismoPct: pct(d.presentismoPct),
    obraSocial: String(d.obraSocial || '').trim(),
    art: String(d.art || '').trim(),
    banco: String(d.banco || '').trim(),
    cbu: digits(d.cbu),
    notas: String(d.notas || '').trim(),
    sector: String(d.sector || '').trim(),
    modalidad: d.modalidad === 'hora' ? 'hora' : 'mensual',
    zona: ZONAS.some((z) => z[0] === d.zona) ? d.zona : 'A',
    valorHora: Number(d.valorHora) || 0,
    valorHoraManual: [true, 'on', 'true'].includes(d.valorHoraManual),
    afiliado: [true, 'on', 'true'].includes(d.afiliado),
    regimen: d.regimen === 'pasantia' ? 'pasantia' : 'dependencia',
    horasSemanales: Math.min(80, Math.max(0, Number(d.horasSemanales) || 0)),
    divisorHora: Number(d.divisorHora) > 0 ? Number(d.divisorHora) : 0,
    fechaFin: d.fechaFin || '',
    institucion: String(d.institucion || '').trim(),
    carrera: String(d.carrera || '').trim(),
    tutorInst: String(d.tutorInst || '').trim(),
    tutorEmpresa: String(d.tutorEmpresa || '').trim(),
    convenioMarco: String(d.convenioMarco || '').trim(),
    domicilio: String(d.domicilio || '').trim(),
    fechaNac: d.fechaNac || '',
    telefono: String(d.telefono || '').trim(),
    email: String(d.email || '').trim(),
  };
  if ('foto' in d) e.foto = typeof d.foto === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(d.foto) && d.foto.length < 150_000 ? d.foto : '';
  if (e.regimen === 'pasantia') e.modalidad = 'mensual';
  else if (e.modalidad !== 'hora' && esJornalizadoPorEscala(e)) e.modalidad = 'hora';   // convenio con escala = jornalizado
  if (e.modalidad === 'hora') {
    // Valor hora: el manual, o el de la escala del convenio. Sueldo = referencia mensual (200 hs) para liquidación final.
    if (!e.valorHoraManual) { const vg = vigenciaEscala(e.convenio, e.categoria, e.zona); if (vg) { e.valorHora = vg.valor; e.convenio = e.convenio || vg.convenio; } }
    e.sueldo = Math.round(e.valorHora * 200 * 100) / 100;
  }
  if (e.regimen === 'pasantia') { e.adicionalAntiguedadPct = 0; e.presentismoPct = 0; e.periodicidad = 'mensual'; }
  return e;
}

export function validateEmployee(e) {
  const errors = {};
  if (!e.nombre || e.nombre.trim().length < 2) errors.nombre = 'Ingresá el nombre completo.';
  if (e.dni && !/^\d{6,9}$/.test(digits(e.dni))) errors.dni = 'El DNI debe tener entre 6 y 9 dígitos.';
  if (e.cuil && !/^\d{11}$/.test(digits(e.cuil))) errors.cuil = 'El CUIL debe tener 11 dígitos.';
  if (e.cbu && !/^\d{22}$/.test(digits(e.cbu))) errors.cbu = 'El CBU debe tener 22 dígitos.';
  if (!isValidISO(e.fechaIngreso)) errors.fechaIngreso = 'Ingresá una fecha de ingreso válida.';
  if (e.fechaEgreso) {
    if (!isValidISO(e.fechaEgreso)) errors.fechaEgreso = 'Fecha de egreso inválida.';
    else if (isValidISO(e.fechaIngreso) && toUTC(parseISO(e.fechaEgreso)) < toUTC(parseISO(e.fechaIngreso)))
      errors.fechaEgreso = 'El egreso no puede ser anterior al ingreso.';
  }
  if (e.modalidad === 'hora') { if (!(Number(e.valorHora) > 0)) errors.valorHora = 'Elegí convenio y categoría con escala, o cargá el valor hora manualmente.'; }
  else if (!(Number(e.sueldo) > 0)) errors.sueldo = 'Ingresá una remuneración mayor a cero.';
  const hs = Number(e.horasSemanales) || 0;
  if (e.regimen === 'pasantia') {
    if (hs <= 0) errors.horasSemanales = 'Cargá las horas semanales de la pasantía.';
    else if (hs > 20) errors.horasSemanales = `La pasantía no puede superar 20 hs semanales (Ley 26.427, art. 13). Cargaste ${hs}.`;
    if (e.fechaFin && isValidISO(e.fechaFin) && isValidISO(e.fechaIngreso)) {
      const meses = daysBetween(parseISO(e.fechaIngreso), parseISO(e.fechaFin)) / 30.4;
      if (meses < 1.9) errors.fechaFin = 'La duración mínima de una pasantía es de 2 meses (art. 13).';
      else if (meses > 18.1) errors.fechaFin = 'La pasantía dura hasta 12 meses, prorrogables 6 más con nuevo acuerdo (art. 13).';
    }
  }
  if (e.fechaFin && !isValidISO(e.fechaFin)) errors.fechaFin = 'Fecha inválida.';
  for (const k of ['adicionalAntiguedadPct', 'presentismoPct']) {
    const n = pct(e[k]);
    if (n < 0 || n > 100) errors[k] = 'Debe estar entre 0 y 100.';
  }
  return errors;
}

export function createEmployeesService(repo) {
  return {
    list: () => repo.list(COL),
    get: (id) => repo.get(COL, id),
    async save(data) {
      const payload = normalizeEmployee(data);
      const errors = validateEmployee(payload);
      if (Object.keys(errors).length) { const e = new Error('VALIDATION'); e.errors = errors; throw e; }
      return data.id ? repo.update(COL, data.id, payload) : repo.create(COL, payload);
    },
    remove: (id) => repo.remove(COL, id),

    /** Eliminación masiva en tandas. Devuelve los ids eliminados y la cantidad que falló. */
    async removeMany(ids, onProgress) {
      const okIds = []; let failed = 0;
      for (let i = 0; i < ids.length; i += 8) {
        const batch = ids.slice(i, i + 8);
        const out = await Promise.allSettled(batch.map((id) => repo.remove(COL, id)));
        out.forEach((r, k) => { if (r.status === 'fulfilled') okIds.push(batch[k]); else failed += 1; });
        onProgress?.(Math.min(i + 8, ids.length), ids.length);
      }
      return { okIds, failed };
    },


    /**
     * Importación masiva. `items`: [{ data, id? }] ya validados.
     * Se procesa en tandas para no saturar Firestore. `onProgress(done,total)`.
     */
    async importMany(items, onProgress) {
      let done = 0;
      const results = [];
      for (let i = 0; i < items.length; i += 8) {
        const batch = items.slice(i, i + 8);
        const out = await Promise.allSettled(batch.map((it) =>
          (it.id ? repo.update(COL, it.id, normalizeEmployee(it.data)) : repo.create(COL, normalizeEmployee(it.data)))));
        out.forEach((r) => results.push(r.status === 'fulfilled' ? { ok: true } : { ok: false, error: r.reason }));
        done += batch.length;
        onProgress?.(done, items.length);
      }
      return { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
    },
  };
}
