/**
 * RECIBO "CLÁSICO" (formato de recibo de empresa: una tabla con código, concepto, cantidad,
 * remuneración c/ y s/ descuentos y deducciones). Datos comunes al PDF y a la vista HTML.
 * Es el formato de los recibos que entregan las empresas de la construcción; el recibo "completo"
 * (art. 140 LCT, Dto. 407/2026) sigue disponible como opción.
 */
import { dateAR } from '../../core/format.js';
import { formatoCuit } from '../../core/cuit.js';
import { montoEnLetras } from '../../core/number-words.js';
import { valorHoraEscala } from '../convenios/escalas.js';

export const FORMATOS_RECIBO = [['completo', 'Completo (art. 140 LCT, Dto. 407/2026: 4 secciones + resumen de costo laboral)'], ['clasico', 'Clásico de empresa (horizontal: original y duplicado en una hoja A4)']];
export const formatoRecibo = (estudio) => (estudio?.reciboFormato === 'clasico' ? 'clasico' : 'completo');

/** Código y rótulo de cada concepto, tal como los imprime el recibo de la empresa. Editá acá para ajustarlos. */
export const CONCEPTOS_CLASICO = {
  basico: [101, 'BASICO HS. NORMALES'], feriado_pago: [102, 'FERIADO NACIONAL (NO TRABAJADO)'], antiguedad: [110, 'ADICIONAL ANTIGUEDAD'], presentismo: [117, 'PRESENTISMO'],
  he50: [103, 'HORAS EXTRAS 50%'], he100: [104, 'HORAS EXTRAS 100%'], feriado: [105, 'FERIADO TRABAJADO'],
  bono: [120, 'ADICIONAL REMUNERATIVO'], no_rem: [130, 'ADICIONAL NO REMUNERATIVO'], sac: [150, 'S.A.C.'], asignacion: [160, 'ASIGNACION ESTIMULO'],
  ap_jubilacion: [401, 'JUBILACION'], ap_pami: [402, 'LEY 23568 INSSJP'], ap_obraSocial: [403, 'OBRA SOCIAL'], ap_sindicato: [422, 'CUOTA SINDICAL'],
  os_adic: [405, 'OB SOC ADIC JORNALIZ'], sindicato: [422, 'SDTO UOCRA AFILIADOS'], solidario: [422, 'APORTE SOLIDARIO UOCRA'], seguro_vida: [425, 'SEGURO DE VIDA CONST'],
  adelanto: [901, 'ADELANTO DE SUELDO'], otros: [902, 'OTROS DESCUENTOS'], ausencias: [910, 'AUSENCIAS INJUSTIFICADAS'], sin_goce: [911, 'LICENCIA SIN GOCE'], hs_desc: [912, 'HORAS NO TRABAJADAS'],
  redondeo: [980, 'REDONDEO'],
};

/** Formato numérico del recibo de empresa: 340,760.00 */
export const fmtUS = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const up = (s) => String(s ?? '').toUpperCase();

/**
 * BASICO del encabezado = valor de la HORA según convenio + categoría (+ zona) a la fecha del período.
 * Por hora: el valor hora de la ficha (manual o de la escala). Mensual: la escala si el convenio la tiene;
 * si no, el sueldo básico dividido por el divisor horario (200 para 48 hs semanales).
 */
export function valorHoraRecibo(run, l) {
  const s = l.snap;
  if (s.modalidad === 'hora' && s.valorHora > 0) return s.valorHora;
  const esc = valorHoraEscala(l.convenio, l.categoria, s.zona || 'A', run.vigencia || run.desde);
  if (esc) return esc;
  return s.modalidad === 'hora' ? s.valorHora : Math.round(((Number(s.sueldo) || 0) / (s.divisorHora || 200)) * 100) / 100;
}

const periodoTexto = (run) => {
  const [y, m] = String(run.hasta || '').split('-');
  if (run.tipo === 'quincenal') return `${run.quincena === 1 ? '1RA' : '2DA'} QUINCENA ${m}/${y}`;
  if (run.tipo === 'sac') return up(run.label);
  return `MENSUAL ${m}/${y}`;
};

const condicionDe = (l) => (l.pago?.estado === 'pagado' ? ({ transferencia: 'TRANSFERENCIA', cheque: 'CHEQUE' }[l.pago.medio] || 'EFECTIVO') : l.cbu ? 'DEPOSITO EN CUENTA' : 'EFECTIVO');

export function datosClasico(run, l, estudio = {}, userName = '', idx = 0) {
  const dep = run.deposito || {};
  const pagado = l.pago?.estado === 'pagado';
  const rows = [
    ...l.rubros.map((r) => { const [cod, lab] = CONCEPTOS_CLASICO[r.id] || [199, up(r.label)]; return { cod, concepto: r.id === 'basico' && l.snap.modalidad !== 'hora' ? 'SUELDO BASICO' : lab, cant: r.id === 'basico' && r.hs != null ? fmtUS(r.hs) : ['hs', 'días'].includes(r.unidad) ? fmtUS(r.cant) : '', cd: r.tipo === 'remunerativo' ? fmtUS(r.amount) : '', sd: r.tipo === 'no_remunerativo' ? fmtUS(r.amount) : '', ded: '' }; }),
    ...l.deducciones.map((d) => { const [cod, lab] = CONCEPTOS_CLASICO[d.id] || [999, up(d.label)]; return { cod, concepto: lab, cant: ['hs', 'días'].includes(d.unidad) ? fmtUS(d.cant) : '', cd: '', sd: '', ded: fmtUS(d.amount) }; }),
  ].sort((a, b) => a.cod - b.cod);
  const letras = montoEnLetras(l.totals.neto).replace(/^Son pesos\s*/i, '').replace(/\.$/, '');
  return {
    emisor: up(estudio.razonSocial || userName), domicilio: up(estudio.domicilio), cuit: formatoCuit(estudio.cuit || ''), cuil: formatoCuit(l.cuil || ''), os: up(l.obraSocial || ''),
    banco: up(l.banco || ''), periodo: periodoTexto(run), condicion: condicionDe(l),
    legajo: l.legajo || '', nombre: up(l.nombre), ingreso: dateAR(l.snap.fechaIngreso), nro: run.reciboDesde ? Number(run.reciboDesde) + idx : idx + 1,
    tipo: run.tipo === 'sac' ? 'S.A.C.' : 'SUELDO',
    depFecha: dep.fecha ? dateAR(dep.fecha) : '', depLapso: dep.periodo || '', depBanco: dep.banco || '',
    basico: fmtUS(valorHoraRecibo(run, l)), cargo: up(l.categoria),
    rows, lugar: run.lugarPago || estudio.lugarPago || '', fecha: pagado ? dateAR(l.pago.fecha) : run.fechaPago ? dateAR(run.fechaPago) : '',
    totCD: fmtUS(l.totals.remunerativo), totSD: fmtUS(l.totals.noRemunerativo), totDed: fmtUS(l.totals.descuentos), neto: fmtUS(l.totals.neto),
    letras: `SON PESOS: ${up(letras)}`,
  };
}
