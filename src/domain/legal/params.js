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
