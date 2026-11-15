import { parseISO, daysInMonth } from '../../../core/dates.js';
import { round2, money } from '../../../core/format.js';
import { superaMeses, superaAnios } from './antiguedad.js';
import { motivoIndemniza, PISO_VIZZOTI } from '../../legal/params.js';

export const enPeriodoPrueba = ({ antig, legal }) => !superaMeses(antig, legal.periodoPruebaMeses);

/** Base indemnizatoria: remuneración con tope de convenio y piso Vizzoti (67%). */
export function baseIndemnizatoria(sueldo, tope) {
  if (tope > 0 && sueldo > tope) {
    const piso = sueldo * PISO_VIZZOTI;
    return { base: Math.max(tope, piso), vizzoti: tope < piso, tope: true };
  }
  return { base: sueldo, vizzoti: false, tope: false };
}

/** Art. 245 LCT. Devuelve [] si el motivo no indemniza. */
export function indemnizacionAntiguedad(ctx) {
  const { inp, antig, legal, warnings } = ctx;
  if (!motivoIndemniza(inp.motivo)) return [];
  if (enPeriodoPrueba(ctx)) {
    warnings.push(`Egreso dentro del período de prueba (${legal.periodoPruebaMeses} meses): no corresponde indemnización por antigüedad (Art. 92 bis LCT).`);
    return [];
  }
  const { base, vizzoti, tope } = baseIndemnizatoria(inp.sueldo, inp.topeConvenio);
  const periodos = Math.max(1, antig.periodos);
  const art = inp.motivo === 'despido_indirecto' ? 'Arts. 245 y 246 LCT' : 'Art. 245 LCT';
  let detail = `${periodos} ${periodos === 1 ? 'período' : 'períodos'} × ${money(base)}`;
  if (tope) detail += vizzoti ? ' (tope limitado al 67% — Vizzoti)' : ' (tope de convenio)';
  if (antig.periodos < 1) detail += ' · mínimo legal de un mes';
  if (vizzoti) ctx.refs.add('CSJN "Vizzoti" (2004)');
  return [{ id: 'indem_245', label: 'Indemnización por antigüedad', detail, amount: round2(base * periodos), tipo: 'indemnizatorio', ref: art }];
}

/** Arts. 231/232 LCT + SAC sobre preaviso. */
export function preaviso(ctx) {
  const { inp, antig, legal } = ctx;
  if (!motivoIndemniza(inp.motivo) || inp.preavisoOtorgado) return [];
  if (enPeriodoPrueba(ctx)) {
    if (legal.sinPreavisoEnPrueba) return [];
    const monto = inp.sueldo / 2;
    return [
      { id: 'preaviso', label: 'Preaviso en período de prueba (15 días)', amount: round2(monto), tipo: 'indemnizatorio', ref: 'Art. 92 bis LCT' },
      { id: 'sac_preaviso', label: 'SAC s/ preaviso', amount: round2(monto / 12), tipo: 'indemnizatorio', ref: 'Art. 232 LCT' },
    ];
  }
  const meses = superaAnios(antig, 5) ? 2 : 1;
  const monto = inp.sueldo * meses;
  return [
    { id: 'preaviso', label: `Indemnización sustitutiva de preaviso (${meses} ${meses === 1 ? 'mes' : 'meses'})`, amount: round2(monto), tipo: 'indemnizatorio', ref: 'Arts. 231 y 232 LCT' },
    { id: 'sac_preaviso', label: 'SAC s/ preaviso', amount: round2(monto / 12), tipo: 'indemnizatorio', ref: 'Art. 232 LCT' },
  ];
}

/** Art. 233 LCT: integración del mes de despido (solo sin preaviso y fuera de prueba). */
export function integracionMes(ctx) {
  const { inp } = ctx;
  if (!motivoIndemniza(inp.motivo) || inp.preavisoOtorgado || enPeriodoPrueba(ctx)) return [];
  const e = parseISO(inp.fechaEgreso);
  const ultimo = daysInMonth(e.y, e.m);
  const dias = ultimo - e.d;
  if (dias <= 0) return [];
  const monto = (inp.sueldo / 30) * dias;
  return [
    { id: 'integracion', label: `Integración mes de despido (${dias} ${dias === 1 ? 'día' : 'días'})`, amount: round2(monto), tipo: 'indemnizatorio', ref: 'Art. 233 LCT' },
    { id: 'sac_integracion', label: 'SAC s/ integración', amount: round2(monto / 12), tipo: 'indemnizatorio', ref: 'Art. 233 LCT' },
  ];
}

/** Gratificación pactada en un acuerdo de extinción (Art. 241). */
export function gratificacionAcuerdo({ inp }) {
  if (inp.motivo !== 'mutuo_acuerdo' || !(inp.acuerdoMonto > 0)) return [];
  return [{ id: 'acuerdo', label: 'Gratificación por mutuo acuerdo', amount: round2(inp.acuerdoMonto), tipo: 'indemnizatorio', ref: 'Art. 241 LCT' }];
}
