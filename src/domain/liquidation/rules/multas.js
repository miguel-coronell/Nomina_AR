import { round2 } from '../../../core/format.js';

/**
 * Multas históricas. Derogadas por Ley 27.742 para extinciones posteriores a
 * su vigencia: solo se calculan en casos anteriores y se avisa en los demás.
 */
export function multas(ctx, parciales) {
  const { inp, legal, warnings } = ctx;
  const pedidas = [inp.multaArt80, inp.multaArt1, inp.multaArt2].some(Boolean);
  if (!pedidas) return [];
  if (!legal.multasVigentes) {
    warnings.push('Las multas del Art. 80 LCT y de la Ley 25.323 (arts. 1 y 2) fueron derogadas por la Ley 27.742 y no se incluyeron para este egreso.');
    return [];
  }
  const out = [];
  const monto = (id) => parciales.find((r) => r.id === id)?.amount || 0;

  if (inp.multaArt80) out.push({ id: 'multa_80', label: 'Sanción Art. 80 LCT (3 remuneraciones)', amount: round2(inp.sueldo * 3), tipo: 'multa', ref: 'Art. 80 LCT · Dec. 146/01' });
  if (inp.multaArt1) {
    const ind = monto('indem_245');
    if (ind > 0) out.push({ id: 'multa_25323_1', label: 'Duplicación indemnización (relación no registrada)', amount: round2(ind), tipo: 'multa', ref: 'Ley 25.323, art. 1' });
    else warnings.push('La multa del art. 1 de la Ley 25.323 requiere indemnización por antigüedad; no se aplicó.');
  }
  if (inp.multaArt2) {
    const base = monto('indem_245') + monto('preaviso') + monto('integracion');
    if (base > 0) out.push({ id: 'multa_25323_2', label: 'Incremento 50% por falta de pago en término', amount: round2(base * 0.5), tipo: 'multa', ref: 'Ley 25.323, art. 2' });
    else warnings.push('La multa del art. 2 de la Ley 25.323 requiere indemnizaciones por despido; no se aplicó.');
  }
  return out;
}
