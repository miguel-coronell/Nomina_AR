/**
 * LIQUIDACIÓN FINAL (recibo por extinción del contrato de trabajo).
 * Misma estructura que el recibo de haberes (art. 140 LCT / Decreto 407/2026) más plazo de pago
 * (arts. 128 y 255 bis LCT), documentación a entregar (art. 80 LCT, ANSES) y cláusula de recibí.
 */
import { dateAR, percent, number } from '../../core/format.js';
import { addBusinessDays } from '../../core/dates.js';
import { montoEnLetras } from '../../core/number-words.js';
import { motivoLabel } from '../../domain/legal/params.js';
import { CONVENIOS, AVISO_LEGAL } from '../../domain/legal/articles.js';
import { costoLaboral, estiloGrafico } from '../../domain/payroll/costo.js';
import { APP } from '../../config/app.config.js';
import { C, D, fs, fitK, t, m$, fechaHora, table, header, section, infoBox, netoBar, paragraph, signatures, tablaContribuciones, resumenCosto, footer } from './common.js';
import { depositoTexto } from './payslip.pdf.js';

const FORMAS = { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro medio' };

/** Dibuja la liquidación en la página actual de `doc` (usa la densidad D.k vigente). */
function drawLiquidacion(doc, rec, estudio, userName, extra) {
  const { input, antiguedad: a, totals: tt } = rec;
  const emisor = estudio.razonSocial || userName || APP.name;
  const pago = rec.pago || {};
  const lugar = pago.lugar || estudio.lugarPago;
  const limite = addBusinessDays(input.fechaEgreso, 4);
  const baseAp = rec.deducciones[0]?.base || 0;
  const costo = costoLaboral({ bruto: tt.bruto, baseAportes: baseAp, deducciones: rec.deducciones, patronales: rec.params?.patronales || extra.patronales || {}, estilo: estiloGrafico(estudio) });

  let y = header(doc, {
    emisor, estudio, titulo: 'LIQUIDACIÓN FINAL', subtitulo: 'Extinción del contrato de trabajo',
    lineas: [`Emitida: ${fechaHora(rec.createdAt || new Date().toISOString())}`, rec.id ? `N.º ${String(rec.id).slice(-8).toUpperCase()}` : ''].filter(Boolean),
  });

  y = section(doc, y, 'IDENTIFICACIÓN: EMPLEADOR, TRABAJADOR Y RELACIÓN LABORAL', 1);
  y = infoBox(doc, y, [
    ['Empleador', emisor], ['CUIT', estudio.cuit],
    ['Domicilio', estudio.domicilio], ['Lugar de pago', lugar],
    ['Trabajador', rec.employeeName || input.nombre], ['CUIL', rec.employeeCuil],
    ['DNI', rec.employeeDni], ['Legajo', rec.employeeLegajo],
    ['Categoría / tarea', rec.categoria], ['Convenio', CONVENIOS.find((c) => c.id === rec.convenio)?.nombre || rec.convenio],
    ['Fecha de ingreso', dateAR(input.fechaIngreso)], ['Fecha de egreso', dateAR(input.fechaEgreso)],
    ['Antigüedad', a.texto], ['Causa de extinción', motivoLabel(input.motivo)],
    ['Mejor remuneración', m$(input.sueldo)], ['Fecha de pago', pago.fecha ? dateAR(pago.fecha) : ''],
    ['Forma de pago', FORMAS[pago.forma] || pago.forma || ''], ['Marco legal aplicado', rec.marco?.ley27802 ? 'Ley 27.802' : rec.marco?.leyBases ? 'Ley 27.742' : 'Régimen anterior'],
  ]);
  y = table(doc, {
    startY: y, body: [['Último depósito de aportes (art. 12 Dto.-ley 17.250/67)', t(depositoTexto(rec.deposito))]],
    styles: { fontSize: fs(7.2) }, columnStyles: { 0: { fontStyle: 'bold', textColor: C.muted, fillColor: C.soft, cellWidth: 70 } },
  }) + 1.5;

  y = section(doc, y, 'CONTRIBUCIONES A CARGO DEL EMPLEADOR (sobre conceptos remunerativos)', 2);
  y = tablaContribuciones(doc, y, costo, 'Sin contribuciones configuradas o sin conceptos remunerativos');

  y = section(doc, y, 'REMUNERACIÓN BRUTA, INDEMNIZACIONES Y DEDUCCIONES', 3);
  const line = (r, col) => {
    const row = [t(r.detail ? `${r.label} - ${r.detail}` : r.label), t(r.ref), '', '', ''];
    row[col] = m$(r.amount);
    return row;
  };
  const rem = rec.rubros.filter((r) => r.tipo === 'remunerativo').map((r) => line(r, 2));
  const ind = rec.rubros.filter((r) => r.tipo === 'indemnizatorio').map((r) => line(r, 3));
  const mul = rec.rubros.filter((r) => r.tipo === 'multa').map((r) => line(r, 3));
  const body = [...rem, ...ind];
  if (mul.length) { body.push([{ content: 'SANCIONES / INCREMENTOS', colSpan: 5, styles: { fontStyle: 'bold', fillColor: C.soft } }]); body.push(...mul); }
  rec.deducciones.forEach((d) => body.push([t(`${d.label} (${percent(d.pct)} s/ ${m$(d.base)})`), 'Aportes de ley', '', '', m$(d.amount)]));
  const remTot = tt.remunerativo, noRem = tt.indemnizatorio + tt.multas;
  y = table(doc, {
    startY: y, head: [['Concepto', 'Base legal', 'Remunerativo', 'No remunerativo', 'Deducciones']], body,
    foot: [['Totales', '', m$(remTot), m$(noRem), m$(tt.deducciones)]],
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 30, fontSize: fs(6.8), textColor: C.muted }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 28 }, 4: { halign: 'right', cellWidth: 28 } },
    didParseCell: (d) => { if (d.section !== 'body' && d.column.index > 1) d.cell.styles.halign = 'right'; },
  }) + 1.5;

  y = section(doc, y, 'REMUNERACIÓN NETA', 4);
  y = netoBar(doc, y, tt.neto) + 4 * D.k;
  y = paragraph(doc, y, { text: montoEnLetras(tt.neto), italic: true, size: 8 });
  if (rec.warnings?.length) y = paragraph(doc, y, { label: 'Observaciones', text: rec.warnings.join(' '), size: 7.2, color: C.muted });
  if (rec.notas) y = paragraph(doc, y, { label: 'Notas', text: rec.notas, size: 7.5 });

  y = resumenCosto(doc, y + 0.5, costo) + 1.5;

  y = section(doc, y, 'PLAZOS Y DOCUMENTACIÓN A ENTREGAR', 5);
  y = table(doc, {
    startY: y, theme: 'plain', styles: { fontSize: fs(7.2), lineWidth: 0, cellPadding: { top: 0.5 * D.k, bottom: 0.5 * D.k, left: 1.6, right: 1.6 } },
    body: [
      ['Plazo de pago', t(`Liquidación final: 4 días hábiles desde la extinción (arts. 128 y 255 bis LCT). Fecha límite estimada: ${dateAR(limite)} (sin considerar feriados).`)],
      ['Documentación', '[  ] Constancia de baja en ARCA   [  ] Certificado art. 80 LCT (ARCA, servicio "Certificado art. 80 LCT"; plazo informado por ARCA: 45 días hábiles)'],
      ['', '[  ] Certificación de Servicios y Remuneraciones (ANSES, formulario PS 6.2)   [  ] Liquidación final (este documento)'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 28 } },
  }) + 1.5;

  y = section(doc, y, 'RECIBÍ', 6);
  y = paragraph(doc, y + 4.2 * D.k, {
    size: 7.6,
    text: `Recibí de ${emisor}${estudio.cuit ? ` (CUIT ${estudio.cuit})` : ''} la suma de ${montoEnLetras(tt.neto).replace(/^Son pesos /, 'pesos ').replace(/\.$/, '')} (${m$(tt.neto)}), en concepto de liquidación final por extinción del contrato de trabajo (${motivoLabel(input.motivo)}), imputable a los conceptos detallados. El pago insuficiente se considera hecho a cuenta del total adeudado (art. 260 LCT).`,
  });
  signatures(doc, y, 'Firma del empleador', 'Firma, aclaración y DNI del trabajador');
}

/** PDF vectorial (A4) de una liquidación final, ajustado para entrar completo en UNA hoja (firma incluida). */
export function buildLiquidacionPDF(J, rec, estudio = {}, userName = '', extra = {}) {
  const doc = new J({ unit: 'mm', format: 'a4' });
  D.k = fitK(J, (tmp) => drawLiquidacion(tmp, rec, estudio, userName, extra));
  drawLiquidacion(doc, rec, estudio, userName, extra);
  D.k = 1;
  footer(doc, `Liquidación final conforme arts. 128, 140 y 255 bis LCT y Decreto 407/2026. ${AVISO_LEGAL} Generado con ${APP.name} ${APP.edition}.`);
  return doc;
}
