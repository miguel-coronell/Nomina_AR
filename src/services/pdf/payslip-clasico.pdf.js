/**
 * RECIBO CLÁSICO de empresa en PDF: A4 horizontal, ORIGINAL y DUPLICADO lado a lado en una sola hoja
 * (una hoja por trabajador). Tipografía serif (Times), tabla con columnas verticales.
 */
import { datosClasico } from '../../domain/payroll/clasico.js';
import { t } from './common.js';
import { getFirmas } from '../firmas.service.js';

const PW = 297, PH = 210, M = 8, GAP = 6;
const CW = (PW - 2 * M - GAP) / 2;       // ancho de cada ejemplar
const TOP = 12, CH = PH - TOP - 8;       // alto de cada ejemplar
const COLS = [0.08, 0.38, 0.10, 0.15, 0.13, 0.16];   // COD, CONCEPTO, C/Hs/%, REM C/D, REM S/D, DEDUCCIONES

function drawCopy(doc, x0, d, titulo, original) {
  const w = CW, y0 = TOP;
  const line = (x1, y1, x2, y2, lw = 0.25) => { doc.setLineWidth(lw); doc.line(x1, y1, x2, y2); };
  const txt = (s, x, y, o = {}) => {
    doc.setFont('times', o.style || 'bold').setFontSize(o.size || 7.5);
    doc.text(t(s), x, y, { align: o.align || 'left', ...(o.maxWidth ? { maxWidth: o.maxWidth } : {}) });
  };
  doc.setDrawColor(0).setTextColor(0);
  txt(titulo, x0 + w / 2, y0 - 2.2, { size: 7, align: 'center', style: 'normal' });
  doc.setLineWidth(0.4).rect(x0, y0, w, CH);

  // ---- Encabezado: empleador (izq.) y banco / período / condición (der.)
  const hx = x0 + w * 0.56;
  txt(d.emisor, x0 + 2, y0 + 5, { size: 8.5, maxWidth: w * 0.54 - 3 });
  txt(d.domicilio, x0 + 2, y0 + 9.5, { size: 7.5, maxWidth: w * 0.54 - 3 });
  txt(`C.U.I.T.: ${d.cuit}`, x0 + 2, y0 + 14.5, { size: 7.5 });
  txt(`C.U.I.L.: ${d.cuil}${d.os ? `     O. S.: ${d.os}` : ''}`, x0 + 2, y0 + 19.5, { size: 7.5, maxWidth: w * 0.54 - 3 });
  line(hx, y0, hx, y0 + 24);
  txt(`BANCO: ${d.banco}`, hx + 2, y0 + 5, { size: 7.5, maxWidth: w * 0.44 - 3 });
  txt(`Período: ${d.periodo}`, hx + 2, y0 + 10.5, { size: 7.5, maxWidth: w * 0.44 - 3 });
  txt('Condición:', hx + 2, y0 + 15.5, { size: 7.5 });
  txt(d.condicion, hx + 2, y0 + 20.5, { size: 7.5 });
  let y = y0 + 24; line(x0, y, x0 + w, y);

  // ---- Legajo / apellido y nombre / ingreso / N° de recibo
  const c1 = x0 + w * 0.10, c2 = x0 + w * 0.56, c3 = x0 + w * 0.80;
  [[x0, c1, 'LEGAJO'], [c1, c2, 'APELLIDO Y NOMBRE'], [c2, c3, 'FECHA DE INGRESO']].forEach(([a, b, s]) => txt(s, (a + b) / 2, y + 3.7, { size: 6.8, align: 'center' }));
  txt(`N° RECIBO: ${d.nro}`, (c3 + x0 + w) / 2, y + 3.7, { size: 6.8, align: 'center' });
  [c1, c2, c3].forEach((cx) => line(cx, y, cx, y + 11.5));
  line(x0, y + 5, x0 + w, y + 5);
  txt(String(d.legajo), (x0 + c1) / 2, y + 9.6, { size: 8, align: 'center' });
  txt(d.nombre, (c1 + c2) / 2, y + 9.6, { size: 8.5, align: 'center', style: 'bolditalic', maxWidth: c2 - c1 - 2 });
  txt(d.ingreso, (c2 + c3) / 2, y + 9.6, { size: 8, align: 'center' });
  txt(d.tipo, (c3 + x0 + w) / 2, y + 9.6, { size: 8, align: 'center' });
  y += 11.5; line(x0, y, x0 + w, y);

  // ---- Último depósito | liquidación / básico | cargo
  const mid = x0 + w * 0.5;
  line(mid, y, mid, y + 16.5);
  txt('ULTIMO DEPOSITO', (x0 + mid) / 2, y + 3.7, { size: 6.8, align: 'center' });
  txt('LIQUIDACION', mid + (x0 + w - mid) * 0.22, y + 3.7, { size: 6.8, align: 'center' });
  txt('BASICO', mid + (x0 + w - mid) * 0.58, y + 3.7, { size: 6.8, align: 'center' });
  txt(d.basico, x0 + w - 2, y + 3.7, { size: 7.5, align: 'right' });
  line(x0, y + 5, x0 + w, y + 5);
  const dw = (mid - x0) / 3;
  [['FECHA', d.depFecha], ['LAPSO', d.depLapso], ['BANCO', d.depBanco]].forEach(([lab, val], i) => {
    const cx = x0 + dw * (i + 0.5);
    txt(lab, cx, y + 8.6, { size: 6.8, align: 'center' });
    txt(val, cx, y + 14, { size: 7, align: 'center', style: 'normal', maxWidth: dw - 1.5 });
    if (i) line(x0 + dw * i, y + 5, x0 + dw * i, y + 16.5);
  });
  line(x0, y + 10, mid, y + 10);
  txt('CARGO', (mid + x0 + w) / 2, y + 8.6, { size: 6.8, align: 'center' });
  txt(d.cargo, (mid + x0 + w) / 2, y + 14, { size: 8, align: 'center', maxWidth: x0 + w - mid - 2 });
  line(mid, y + 10, x0 + w, y + 10);
  y += 16.5; line(x0, y, x0 + w, y);

  // ---- Tabla de conceptos
  const xs = [x0]; COLS.forEach((c) => xs.push(xs[xs.length - 1] + c * w));
  const heads = ['COD.', 'CONCEPTO', 'C/Hs./%', 'REM. C/D', 'REM. S/D', 'DEDUCCIONES'];
  heads.forEach((s, i) => txt(s, (xs[i] + xs[i + 1]) / 2, y + 3.9, { size: 6.8, align: 'center' }));
  const yHead = y + 5.5; line(x0, yHead, x0 + w, yHead);
  const yFoot = y0 + CH - 46;                                  // donde empieza el pie
  xs.slice(1, -1).forEach((cx) => line(cx, y, cx, yFoot));
  let ry = yHead + 4.6;
  const paso = Math.min(4.4, (yFoot - ry - 1) / Math.max(1, d.rows.length));
  d.rows.forEach((r) => {
    txt(String(r.cod), xs[0] + 1.5, ry, { size: 7.6 }); txt(r.concepto, xs[1] + 1.5, ry, { size: 7.6, maxWidth: xs[2] - xs[1] - 2 });
    txt(r.cant, xs[3] - 1.5, ry, { size: 7.6, align: 'right' }); txt(r.cd, xs[4] - 1.5, ry, { size: 7.6, align: 'right' });
    txt(r.sd, xs[5] - 1.5, ry, { size: 7.6, align: 'right' }); txt(r.ded, xs[6] - 1.5, ry, { size: 7.6, align: 'right' });
    ry += paso;
  });

  // ---- Pie: lugar, fecha y totales
  line(x0, yFoot, x0 + w, yFoot);
  [['LUGAR DE PAGO', x0, xs[2]], ['FECHA', xs[2], xs[3]], ['TOTAL', xs[3], xs[4]], ['TOTAL', xs[4], xs[5]], ['TOTAL', xs[5], xs[6]]].forEach(([s, a, b]) => txt(s, (a + b) / 2, yFoot + 3.9, { size: 6.8, align: 'center' }));
  line(x0, yFoot + 5.5, x0 + w, yFoot + 5.5);
  txt(d.lugar, x0 + 1.5, yFoot + 10, { size: 7.6, maxWidth: xs[2] - x0 - 3 });
  txt(d.fecha, (xs[2] + xs[3]) / 2, yFoot + 10, { size: 7.6, align: 'center' });
  txt(d.totCD, xs[4] - 1.5, yFoot + 10, { size: 7.6, align: 'right' }); txt(d.totSD, xs[5] - 1.5, yFoot + 10, { size: 7.6, align: 'right' }); txt(d.totDed, xs[6] - 1.5, yFoot + 10, { size: 7.6, align: 'right' });
  [xs[2], xs[3], xs[4], xs[5]].forEach((cx) => line(cx, yFoot, cx, yFoot + 11));
  line(x0, yFoot + 11, x0 + w, yFoot + 11);
  doc.setLineWidth(0.25);
  // NETO (columna derecha) + importe en letras (izquierda)
  const nx = xs[5];
  txt('NETO', (nx + x0 + w) / 2, yFoot + 15.6, { size: 7, align: 'center' });
  doc.rect(nx, yFoot + 17, x0 + w - nx, 8);
  txt(d.neto, x0 + w - 2, yFoot + 22.7, { size: 9, align: 'right' });
  // Ejemplar ORIGINAL (empresa): "recibí conforme" y firma del empleado. DUPLICADO (trabajador): firma del empleador, sin "recibí conforme".
  if (original) txt('RECIBI CONFORME LA SUMA DE:', x0 + 3, yFoot + 17, { size: 7.4 });
  txt(d.letras, x0 + 3, yFoot + 22, { size: 7.4, maxWidth: nx - x0 - 5 });
  txt('EN CONCEPTO DE REMUNERACIONES CORRESPONDIENTES AL', x0 + 3, yFoot + 30, { size: 7.4 });
  txt('PERIODO ARRIBA INDICADO.', x0 + 3, yFoot + 34.5, { size: 7.4 });
  const fx = x0 + w * 0.5, fw = w * 0.5 - 3;
  const firmas = d.firmas || {};
  const fd = firmas[original ? 'empleado' : 'empleador'];
  const yl = yFoot + 37; // línea de firma (deja lugar al trazo digital arriba)
  doc.setLineDashPattern([0.6, 0.8], 0).setLineWidth(0.3).line(fx, yl, x0 + w - 3, yl);
  doc.setLineDashPattern([], 0);
  txt(original ? 'FIRMA DEL EMPLEADO' : 'FIRMA DEL EMPLEADOR', fx + fw / 2, yl + 3.5, { size: 7.4, align: 'center' });
  if (fd?.img) {
    try {
      const mh = 10.5, mw = fw * 0.7, k = Math.min(mw / (fd.w || 1), mh / (fd.h || 1)), iw = (fd.w || 1) * k, ih = (fd.h || 1) * k;
      doc.addImage(fd.img, 'PNG', fx + fw / 2 - iw / 2, yl - ih - 0.4, iw, ih);
    } catch { /* sin imagen */ }
  }
}

/** Una página A4 horizontal por trabajador: ORIGINAL (izq.) y DUPLICADO (der.). */
export function buildPayslipsClasicoPDF(J, run, lines, estudio = {}, userName = '') {
  const doc = new J({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  lines.forEach((l, i) => {
    if (i) doc.addPage('a4', 'landscape');
    const idx = Math.max(0, run.lines.findIndex((x) => x.employeeId === l.employeeId));
    const d = datosClasico(run, l, estudio, userName, idx);
    d.firmas = getFirmas(run, l);
    drawCopy(doc, M, d, 'ORIGINAL - EMPRESA', true);
    drawCopy(doc, M + CW + GAP, d, 'DUPLICADO - TRABAJADOR', false);
  });
  return doc;
}
