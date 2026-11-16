/**
 * PARÁMETROS Y MARCO LEGAL
 * ---------------------------------------------------------------
 * Todo lo que depende de la fecha / de la reforma vigente vive acá, de modo
 * que actualizar la normativa sea tocar UN archivo.
 *
 * Revisión: octubre 2026. Las fechas son orientativas: verificar siempre con
 * el texto oficial y la jurisprudencia aplicable antes de presentar un cálculo.
 */

export const FECHAS_LEGALES = {
  /** Ley 27.742 (Ley Bases). Derogó las multas de Ley 24.013 (arts. 8, 9, 10, 15),
   *  Ley 25.323 (arts. 1 y 2) y la sanción del art. 80 LCT (Ley 25.345). */
  leyBases: '2024-07-09',
  /** Ley 27.802 de Modernización Laboral (BO 06/03/2026). Nuevo art. 245,
   *  período de prueba ampliado y sin preaviso durante el mismo. */
  ley27802: '2026-03-06',
};

/** Meses del período de prueba según la fecha de egreso (art. 92 bis LCT). */
export const PERIODO_PRUEBA = { previo: 3, leyBases: 6, ley27802: 8 };

export const MOTIVOS = [
  { id: 'despido_sin_causa', label: 'Despido sin causa (Art. 245)', indemniza: true },
  { id: 'despido_indirecto', label: 'Despido indirecto (Art. 246)', indemniza: true },
  { id: 'renuncia', label: 'Renuncia voluntaria', indemniza: false },
  { id: 'mutuo_acuerdo', label: 'Mutuo acuerdo (Art. 241)', indemniza: false },
  { id: 'despido_con_causa', label: 'Despido con justa causa (Art. 242)', indemniza: false },
  { id: 'jubilacion', label: 'Jubilación (Art. 252)', indemniza: false },
];
export const motivoLabel = (id) => MOTIVOS.find((m) => m.id === id)?.label || id;
export const motivoIndemniza = (id) => !!MOTIVOS.find((m) => m.id === id)?.indemniza;

/** Resuelve qué reglas rigen para una fecha de egreso dada. */
export function resolverMarcoLegal(fechaEgreso, settings = {}) {
  const postBases = fechaEgreso >= FECHAS_LEGALES.leyBases;
  const post27802 = fechaEgreso >= FECHAS_LEGALES.ley27802;
  const auto = post27802 ? PERIODO_PRUEBA.ley27802 : postBases ? PERIODO_PRUEBA.leyBases : PERIODO_PRUEBA.previo;
  const override = Number(settings.periodoPruebaMeses) || 0;
  return {
    ley27802: post27802,
    leyBases: postBases,
    multasVigentes: !postBases,           // multas derogadas para extinciones posteriores
    sinPreavisoEnPrueba: post27802,       // Ley 27.802
    periodoPruebaMeses: override > 0 ? override : auto,
    periodoPruebaManual: override > 0,
  };
}

/** Vizzoti (CSJN 2004): el tope no puede reducir la base en más de un 33%. */
export const PISO_VIZZOTI = 0.67;
export const DIVISOR_HORA = 200;     // remuneración mensual / 200 = valor hora
export const DIVISOR_VACACIONES = 25; // Art. 155 LCT

/**
 * BASE IMPONIBLE MÍNIMA SIPA por vigencia (Dto. 488/2011). El piso de obra social es el doble.
 * Para agregar un mes nuevo: sumá una fila con su fecha `desde` (ISO). Cada período toma la vigencia
 * más reciente anterior o igual a su fecha de inicio.
 */
export const BASES_MINIMAS_SIPA = [
  { desde: '2026-10-01', valor: 146759.98, fuente: 'Res. ANSES 284/2026' },
  { desde: '2026-11-01', valor: 149592.45, fuente: 'Res. ANSES 304/2026' },
];

const BASES_SIPA_FABRICA = BASES_MINIMAS_SIPA.map((x) => ({ ...x }));
/** Monta las bases que el usuario cargó en «Escalas y vigencias» sobre las de fábrica (misma fecha = pisa). */
export function aplicarBasesSipa(extra = []) {
  const m = new Map();
  [...BASES_SIPA_FABRICA, ...extra].forEach((x) => { if (x?.desde && x.valor > 0) m.set(x.desde, { ...x }); });
  BASES_MINIMAS_SIPA.splice(0, BASES_MINIMAS_SIPA.length, ...[...m.values()].sort((a, b) => a.desde.localeCompare(b.desde)));
}
export { BASES_SIPA_FABRICA };

/** Vigencia aplicable a una fecha ISO: { valor, desde, fuente } o null si no hay ninguna cargada. */
export function baseMinimaSipa(fecha) {
  const v = [...BASES_MINIMAS_SIPA].filter((x) => x.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde))[0];
  return v || null;
}
