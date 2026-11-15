/** Contenido de la sección "Normativa" (texto explicativo, no transcripción oficial). */

export const ARTICULOS = [
  {
    id: 'art-140',
    ref: 'Art. 140 LCT · Dec. 407/2026',
    titulo: 'Contenido del recibo de haberes',
    texto:
      'La Ley 27.802 reformó el art. 140: el recibo debe incluir razón social, domicilio y CUIT del empleador; nombre del trabajador, su calificación y CUIL; los datos del art. 12 del Dto.-ley 17.250/67; el neto en números y letras; lugar y fecha del pago real y efectivo; fecha de ingreso y tarea o categoría; y las contribuciones abonadas por el empleador. El Decreto 407/2026 (vigente desde el 01/06/2026) lo organiza en cuatro secciones (identificación, contribuciones del empleador, remuneración bruta y deducciones, remuneración neta), informa cada concepto con base de cálculo, unidad y monto, y exige en el anverso un resumen del costo laboral total por rubro con gráfico, según el modelo del Anexo III. Verificá tu formato final contra ese Anexo.',
  },
  {
    id: 'art-12-17250',
    ref: 'Art. 12 Dto.-ley 17.250/67',
    titulo: 'Constancia del último depósito de aportes',
    texto: 'El recibo debe consignar el período, la fecha y el banco del último depósito de aportes y contribuciones de seguridad social. Se completa en Nómina → Datos del recibo.',
  },
  {
    id: 'art-128',
    ref: 'Arts. 128 y 255 bis LCT',
    titulo: 'Plazo para pagar la liquidación final',
    texto: 'La liquidación final debe abonarse dentro de los 4 días hábiles de la extinción del contrato, cualquiera sea su causa (criterio sostenido por la CNAT). El documento calcula una fecha límite estimada, sin considerar feriados.',
  },
  {
    id: 'art-80',
    ref: 'Art. 80 LCT',
    titulo: 'Certificados al egreso',
    texto: 'Al extinguirse la relación el empleador debe entregar el certificado de trabajo (datos de la relación, función, capacitaciones y constancia de ingreso de aportes y contribuciones), que se emite por ARCA (plazo informado por el organismo: 45 días hábiles), y la Certificación de Servicios y Remuneraciones de ANSES (PS 6.2).',
  },
  {
    id: 'art-245',
    ref: 'Art. 245 LCT',
    titulo: 'Indemnización por antigüedad o despido',
    texto:
      'Ante un despido sin justa causa corresponde un mes de remuneración por cada año de servicio o fracción mayor a tres meses, nunca menos de un mes. La Ley 27.802 reformó su texto: la base se limita a la remuneración mensual, normal y habitual, y excluye SAC, vacaciones y pagos no mensuales. El tope se aplica con el límite del fallo Vizzoti (la base no puede reducirse más de un 33%).',
  },
  {
    id: 'art-231-232',
    ref: 'Arts. 231 y 232 LCT',
    titulo: 'Preaviso',
    texto:
      'El empleador debe preavisar con 1 mes (antigüedad hasta 5 años) o 2 meses (más de 5 años). Si no lo hace, adeuda la indemnización sustitutiva más el SAC sobre ese concepto. Con la Ley 27.802 no corresponde preaviso durante el período de prueba.',
  },
  {
    id: 'art-233',
    ref: 'Art. 233 LCT',
    titulo: 'Integración del mes de despido',
    texto:
      'Si el despido ocurre sin preaviso y no coincide con el último día del mes, se adeudan los días faltantes hasta fin de mes (remuneración / 30 × días), más SAC.',
  },
  {
    id: 'art-92bis',
    ref: 'Art. 92 bis LCT',
    titulo: 'Período de prueba',
    texto:
      'Durante el período de prueba cualquiera de las partes puede extinguir el contrato sin derecho a indemnización por antigüedad. La duración fue de 3 meses, luego 6 (Ley 27.742) y se amplió con la Ley 27.802. Ajustable en Configuración.',
  },
  {
    id: 'art-150-156',
    ref: 'Arts. 150, 155 y 156 LCT',
    titulo: 'Vacaciones no gozadas',
    texto:
      'Corresponden 14, 21, 28 o 35 días según la antigüedad al 31 de diciembre. Al egreso se pagan las no gozadas en forma proporcional al tiempo trabajado en el año (remuneración / 25 × días), con su SAC.',
  },
  {
    id: 'sac',
    ref: 'Ley 23.041',
    titulo: 'SAC proporcional (aguinaldo)',
    texto:
      'Se liquida la proporción del semestre trabajado: la mitad de la mejor remuneración del semestre por los días trabajados sobre los días del semestre.',
  },
  {
    id: 'art-241',
    ref: 'Art. 241 LCT',
    titulo: 'Extinción por mutuo acuerdo',
    texto:
      'Debe celebrarse por escrito ante la autoridad administrativa o judicial. La gratificación pactada puede cargarse en el simulador como "monto acordado".',
  },
  {
    id: 'fal',
    ref: 'Ley 27.802',
    titulo: 'Fondo de Asistencia Laboral (FAL)',
    texto:
      'Los empleadores aportan mensualmente entre el 1% y el 2,5% de las remuneraciones a un fondo que puede utilizarse para afrontar indemnizaciones. No reemplaza la obligación indemnizatoria. Este simulador calcula el monto adeudado, sin descontar fondos.',
  },
];

/** Contenido exigido a los documentos (verificado con fuentes oficiales y doctrina; revisión octubre 2026). */
export const ESTRUCTURA_RECIBO = {
  titulo: 'Recibo de haberes',
  base: 'Art. 140 LCT (texto Ley 27.802) · Decreto 407/2026 (BO 01/06/2026) · Art. 12 Dto.-ley 17.250/67',
  items: [
    ['Nombre o razón social del empleador, domicilio y CUIT', 'Configuración → Datos del empleador'],
    ['Nombre y apellido del trabajador, calificación profesional y CUIL', 'Ficha del empleado (categoría y CUIL)'],
    ['Fecha de ingreso y tarea o categoría desempeñada en el período', 'Ficha del empleado'],
    ['Período de pago', 'Automático según la nómina'],
    ['Lugar y fecha del pago real y efectivo', 'Nómina → Datos del recibo y registro de pagos'],
    ['Último depósito de aportes y contribuciones: período, fecha y banco (art. 12 Dto.-ley 17.250/67)', 'Nómina → Datos del recibo'],
    ['Contribuciones y conceptos abonados por el empleador (inc. j), con su importe', 'Sección 2 del recibo (porcentajes en Configuración)'],
    ['Conceptos con cantidad, unidad de medida, base de cálculo y monto', 'Sección 3 del recibo'],
    ['Remuneración neta en números y letras', 'Sección 4 del recibo'],
    ['Resumen del costo laboral total por rubro, con gráfico, en el anverso', 'Resumen al pie de la primera hoja'],
    ['Firma del empleador y confección en doble ejemplar', 'Líneas de firma; imprimir dos ejemplares'],
  ],
};
export const ESTRUCTURA_LIQUIDACION = {
  titulo: 'Liquidación final',
  base: 'Arts. 128, 140, 255 bis y 80 LCT · Decreto 407/2026 · Certificación ANSES PS 6.2',
  items: [
    ['Datos del empleador, del trabajador, fechas de ingreso y egreso y causa de extinción', 'Secciones 1 y 3'],
    ['Mejor remuneración mensual normal y habitual y detalle de cada concepto con su base legal', 'Sección 3'],
    ['Neto en números y letras, forma, lugar y fecha de pago', 'Sección 4 y datos de pago del simulador'],
    ['Plazo de pago: 4 días hábiles desde la extinción (arts. 128 y 255 bis)', 'Sección 5 (fecha límite estimada)'],
    ['Entrega de constancia de baja, certificado art. 80 y certificación de servicios (ANSES)', 'Sección 5 (checklist)'],
    ['Recibí con firma y aclaración; el pago insuficiente vale como pago a cuenta (art. 260)', 'Sección 6'],
  ],
};

export const ARTICULOS_RRHH = [
  { id: 'art-201', ref: 'Art. 201 LCT', titulo: 'Horas suplementarias', texto: 'Las horas que exceden la jornada se pagan con un recargo del 50% en días comunes y del 100% los sábados después de las 13 hs, los domingos y los feriados (la Ley 27.802 no modificó estos recargos). El valor de la hora se obtiene dividiendo la remuneración mensual por 200 para jornadas de 48 hs semanales; el sistema proporciona el divisor según la jornada y lo podés ajustar por empleado. Las horas extra tienen límites diarios, mensuales y anuales (el sistema avisa con los valores habituales del Dto. 484/2000: 3 diarias, 30 mensuales, 200 anuales: confirmá si tu actividad tiene otro régimen).' },
  { id: 'art-197bis', ref: 'Art. 197 bis LCT (Ley 27.802)', titulo: 'Banco de horas', texto: 'Con acuerdo escrito entre las partes, las horas trabajadas de más pueden compensarse con francos en vez de pagarse como extras. En el sistema, marcá "Banco de horas" en la ficha: las extras se acumulan y se descuentan al registrar un franco compensatorio.' },
  { id: 'art-166', ref: 'Art. 166 LCT', titulo: 'Feriados', texto: 'Los feriados nacionales son inhábiles: quien trabaja en ellos cobra un día adicional (doble jornal). Los días no laborables son optativos para el empleador y, si se trabajan, se pagan como un día común. El calendario 2026 está precargado (incluye el feriado del 9/11 y el traslado al 23/11) y podés agregar feriados provinciales o locales.' },
  { id: 'art-150', ref: 'Arts. 150 a 157 LCT', titulo: 'Vacaciones', texto: 'Corresponden 14, 21, 28 o 35 días corridos según la antigüedad al 31/12 (1 día cada 20 de trabajo si se trabajó menos de la mitad del año). La Ley 27.802 permite fraccionarlas en tramos de al menos 7 días corridos. El legajo muestra los días correspondientes, tomados y el saldo.' },
  { id: 'art-92ter', ref: 'Art. 92 ter LCT', titulo: 'Jornada parcial', texto: 'En el contrato a tiempo parcial la remuneración es proporcional a la jornada. Podés cargar un horario distinto por día (por ejemplo 4 hs el viernes y 8 el resto) y el sistema calcula las horas extra sobre la jornada de cada día.' },
  { id: 'ley-26427', ref: 'Ley 26.427', titulo: 'Pasantías educativas', texto: 'Para estudiantes mayores de 18 años, con convenio entre la empresa y la institución educativa (por ejemplo la UNCuyo). No genera relación laboral: se abona una asignación estímulo no remunerativa, proporcional a la jornada y calculada sobre el salario de convenio. Duración de 2 a 12 meses (prorrogable 6 más), hasta 20 hs semanales y 6 hs 30 min diarias. Corresponden obra social y ART; no hay aportes jubilatorios ni SAC ni vacaciones. El sistema valida los límites y emite un recibo de asignación estímulo.' },
];

export const MULTAS = [
  { ref: 'Art. 80 LCT (Dec. 146/01)', desc: 'Falta de entrega del certificado de trabajo: 3 remuneraciones.', vigente: false },
  { ref: 'Ley 25.323, art. 1', desc: 'Relación no registrada o deficientemente registrada: duplica la indemnización del Art. 245.', vigente: false },
  { ref: 'Ley 25.323, art. 2', desc: 'Falta de pago en término y reclamo judicial: incremento del 50%.', vigente: false },
  { ref: 'Ley 24.013, arts. 8, 9, 10 y 15', desc: 'Multas por falta o deficiente registración.', vigente: false },
];

export const MULTAS_NOTA =
  'La Ley 27.742 (Ley Bases) derogó estas sanciones para extinciones posteriores a su entrada en vigencia. El simulador las calcula únicamente para egresos anteriores al 09/07/2024 (casos en trámite o reclamos históricos). La aplicación retroactiva es materia de debate jurisprudencial.';

export const CONVENIOS = [
  { id: 'comercio', nombre: 'CCT 130/75 — Empleados de Comercio' },
  { id: 'construccion', nombre: 'CCT 76/75 — Construcción (UOCRA)' },
  { id: 'metalurgico', nombre: 'CCT 260/75 — Metalúrgicos (UOM)' },
  { id: 'bancario', nombre: 'CCT 18/75 — Bancarios' },
  { id: 'gastronomicos', nombre: 'CCT 389/04 — Gastronómicos (UTHGRA)' },
  { id: 'camioneros', nombre: 'CCT 40/89 — Camioneros' },
  { id: 'fuera_convenio', nombre: 'Fuera de convenio' },
];

export const AVISO_LEGAL =
  'Las estimaciones son orientativas y no reemplazan el criterio de un profesional matriculado. Verificá las escalas, topes y normativa vigentes antes de presentar un cálculo.';
