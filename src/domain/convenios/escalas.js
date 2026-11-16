/**
 * ESCALAS SALARIALES POR CONVENIO (personal jornalizado, pago por hora).
 * Para agregar una paritaria nueva: sumá un objeto a `vigencias` con la fecha `desde` (ISO) y los
 * valores por zona. Cada período de nómina toma la vigencia que corresponde a su fecha de inicio.
 * Valores: Zona A básicos por hora, publicados por UOCRA/prensa especializada (octubre y noviembre 2026).
 * VERIFICAR con la escala homologada vigente antes de liquidar. No incluyen sumas no remunerativas.
 */
import { CONVENIOS } from '../legal/articles.js';

export const ZONAS = [
  ['A', 'Zona A (CABA, Buenos Aires, Mendoza y resto del país)'],
  ['B', 'Zona B (La Pampa, Neuquén, Río Negro, Chubut)'],
  ['C', 'Zona C (Santa Cruz)'],
  ['CA', 'Zona C Austral (Tierra del Fuego)'],
];

export const ESCALAS = {
  construccion: {
    nombre: 'CCT 76/75 — Construcción (UOCRA)',
    unidad: 'hora',
    presentismoPct: 20,
    categorias: ['Ayudante', 'Medio Oficial', 'Oficial', 'Oficial Especializado'],
    vigencias: [
      { desde: '2026-10-01', zonas: {
        A: { 'Ayudante': 5601, 'Medio Oficial': 6085, 'Oficial': 6585, 'Oficial Especializado': 7697 },
        B: { 'Ayudante': 6245, 'Medio Oficial': 6745, 'Oficial': 7313, 'Oficial Especializado': 8544 },
        C: { 'Ayudante': 10381, 'Medio Oficial': 10691, 'Oficial': 11079, 'Oficial Especializado': 11817 },
        CA: { 'Ayudante': 11201, 'Medio Oficial': 12170, 'Oficial': 13169, 'Oficial Especializado': 15395 },
      } },
      { desde: '2026-11-01', zonas: {
        A: { 'Ayudante': 5696, 'Medio Oficial': 6188, 'Oficial': 6697, 'Oficial Especializado': 7828 },
      } },
    ],
  },
  // Personal jornalizado, Rama 17 (metalmecánica) y ramas que usan su planilla. Valores por hora publicados por la UOM/prensa
  // especializada para octubre 2026; en noviembre rigen los mismos (sin aumento, solo bono no remunerativo). VERIFICAR con la escala homologada.
  uom: {
    nombre: 'CCT 260/75 — Metalúrgicos Rama 17 (UOM)',
    unidad: 'hora',
    presentismoPct: 0,
    categorias: ['Ingresante', 'Operario Calificado', 'Medio Oficial', 'Operario Especializado', 'Operario Especializado Múltiple', 'Oficial', 'Oficial Múltiple', 'Oficial Múltiple Superior'],
    vigencias: [
      { desde: '2026-10-01', zonas: {
        A: { 'Ingresante': 4665.41, 'Operario Calificado': 5054.03, 'Medio Oficial': 5447.03, 'Operario Especializado': 5827.06, 'Operario Especializado Múltiple': 6160.40, 'Oficial': 6445.08, 'Oficial Múltiple': 6942.35, 'Oficial Múltiple Superior': 7428.88 },
      } },
    ],
  },
};

// Copia de fábrica: las tablas de arriba son las que trae la app; las que carga el usuario se montan encima (aplicarTablas).
const ESCALAS_BASE = structuredClone(ESCALAS);

export const convenioPorHora = (id) => !!ESCALAS[id];

/** Ids viejos que ahora son otro: las fichas ya guardadas con el id anterior siguen funcionando. */
const ALIAS_CONVENIO = { metalurgico: 'uom' };
export const convenioId = (id) => ALIAS_CONVENIO[id] || id;

/**
 * Lista ÚNICA de convenios de la app (ficha de empleado, importador y «Escalas y vigencias»):
 * los de referencia + los que el usuario creó. `conEscala` = ya tiene escala de valor hora cargada.
 */
export function listaConvenios() {
  const ref = CONVENIOS.map((c) => ({ id: c.id, nombre: ESCALAS[c.id]?.nombre || c.nombre }));
  const propios = Object.entries(ESCALAS).filter(([id]) => !CONVENIOS.some((c) => c.id === id)).map(([id, e]) => ({ id, nombre: e.nombre }));
  return [...ref, ...propios].map((c) => ({ ...c, conEscala: !!ESCALAS[c.id] }));
}
export const categoriasDe = (id) => ESCALAS[id]?.categorias || [];

/** Fechas «desde» de todas las vigencias cargadas (de fábrica y propias), de la más nueva a la más vieja. */
export const vigenciasDisponibles = () => [...new Set(Object.values(ESCALAS).flatMap((e) => (e.vigencias || []).map((v) => v.desde)))].sort((a, b) => b.localeCompare(a));

/** Normaliza para comparar: minúsculas, sin tildes, sin signos y con un solo espacio. */
export const normCat = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Convenio al que corresponde una categoría. Si la ficha no tiene convenio, se deduce de la categoría
 * cuando existe en un único convenio con escala; si está en varios, se asume Construcción.
 */
export function resolverConvenio(convenio, categoria) {
  if (convenio) return ESCALAS[convenioId(convenio)] ? convenioId(convenio) : null;
  const n = normCat(categoria);
  if (!n) return null;
  const hits = Object.entries(ESCALAS).filter(([, e]) => (e.categorias || []).some((c) => normCat(c) === n)).map(([id]) => id);
  // Si está en varios, una ficha sin convenio sigue tratándose como Construcción (igual que el cálculo de jornaleros hasta ahora).
  return hits.length === 1 ? hits[0] : hits.includes('construccion') ? 'construccion' : null;
}

/** Valor hora y desde cuándo rige: { valor, desde, convenio } o null si no hay dato para esa fecha. */
export function vigenciaEscala(convenio, categoria, zona = 'A', fecha = new Date().toISOString().slice(0, 10)) {
  const id = resolverConvenio(convenio, categoria);
  const esc = id && ESCALAS[id];
  if (!esc || !categoria) return null;
  const n = normCat(categoria);
  const vigs = [...esc.vigencias].filter((v) => v.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde));
  for (const v of vigs) {
    const t = v.zonas[zona] || (zona !== 'A' ? null : v.zonas.A);
    const val = t && Object.entries(t).find(([k]) => normCat(k) === n)?.[1];
    if (val) return { valor: val, desde: v.desde, convenio: id };
  }
  return null;
}

/** Valor hora de la escala para convenio + categoría + zona a una fecha (ISO). null si no hay dato. */
export const valorHoraEscala = (convenio, categoria, zona = 'A', fecha) => vigenciaEscala(convenio, categoria, zona, fecha)?.valor ?? null;

/**
 * Básico MENSUAL de la categoría Sereno, Zona A (base del seguro de vida colectivo, art. 108 CCT 76/75).
 * Una fila por vigencia; se toma la más reciente anterior o igual a la fecha. VERIFICAR con la escala homologada.
 */
export const SERENO_ZONA_A = [
  { desde: '2026-10-01', valor: 1017485 },
];
const SERENO_BASE = structuredClone(SERENO_ZONA_A);
export function basicoSerenoZonaA(fecha) {
  return [...SERENO_ZONA_A].filter((x) => x.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde))[0] || null;
}

/** Suma filas por fecha `desde`: las del usuario pisan a las de fábrica con la misma fecha. */
const unirPorDesde = (base = [], extra = []) => {
  const m = new Map();
  [...base, ...extra].forEach((x) => { if (x?.desde) m.set(x.desde, { ...x }); });
  return [...m.values()].sort((a, b) => a.desde.localeCompare(b.desde));
};

function unirConvenio(base, user) {
  if (!base) return structuredClone(user);
  if (!user) return structuredClone(base);
  const vigs = new Map();
  [...base.vigencias, ...(user.vigencias || [])].forEach((v) => {
    const prev = vigs.get(v.desde) || { desde: v.desde, zonas: {} };
    Object.entries(v.zonas || {}).forEach(([z, cats]) => { prev.zonas[z] = { ...(prev.zonas[z] || {}), ...cats }; });
    vigs.set(v.desde, prev);
  });
  return {
    ...base, ...user,
    nombre: user.nombre || base.nombre,
    categorias: [...new Set([...(base.categorias || []), ...(user.categorias || [])])],
    vigencias: [...vigs.values()].sort((a, b) => a.desde.localeCompare(b.desde)),
  };
}

/**
 * Monta sobre las tablas de fábrica lo que el usuario cargó en la pantalla «Escalas y vigencias»
 * (settings.tablas). Se llama al abrir la app y cada vez que se guardan los ajustes.
 */
export function aplicarTablas(tablas = {}) {
  Object.keys(ESCALAS).forEach((k) => delete ESCALAS[k]);
  const ids = new Set([...Object.keys(ESCALAS_BASE), ...Object.keys(tablas.convenios || {})]);
  ids.forEach((id) => { ESCALAS[id] = unirConvenio(ESCALAS_BASE[id], tablas.convenios?.[id]); });
  SERENO_ZONA_A.splice(0, SERENO_ZONA_A.length, ...unirPorDesde(SERENO_BASE, tablas.sereno));
}
export { unirPorDesde, ESCALAS_BASE, SERENO_BASE };
