/**
 * ESCALAS SALARIALES POR CONVENIO (personal jornalizado, pago por hora).
 * Para agregar una paritaria nueva: sumá un objeto a `vigencias` con la fecha `desde` (ISO) y los
 * valores por zona. Cada período de nómina toma la vigencia que corresponde a su fecha de inicio.
 * Valores: Zona A básicos por hora, publicados por UOCRA/prensa especializada (octubre y noviembre 2026).
 * VERIFICAR con la escala homologada vigente antes de liquidar. No incluyen sumas no remunerativas.
 */
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
};

export const convenioPorHora = (id) => !!ESCALAS[id];
export const categoriasDe = (id) => ESCALAS[id]?.categorias || [];

/** Valor hora de la escala para convenio + categoría + zona a una fecha (ISO). null si no hay dato. */
export function valorHoraEscala(convenio, categoria, zona = 'A', fecha = new Date().toISOString().slice(0, 10)) {
  const esc = ESCALAS[convenio];
  if (!esc || !categoria) return null;
  const vigs = [...esc.vigencias].filter((v) => v.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde));
  for (const v of vigs) {
    const t = v.zonas[zona] || (zona !== 'A' ? null : v.zonas.A);
    const val = t && Object.entries(t).find(([k]) => k.toLowerCase() === String(categoria).trim().toLowerCase())?.[1];
    if (val) return val;
  }
  return null;
}
