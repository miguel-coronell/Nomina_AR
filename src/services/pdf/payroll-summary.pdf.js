import { dateAR } from '../../core/format.js';
import { tipoLabel } from '../../domain/payroll/periodos.js';
import { APP } from '../../config/app.config.js';
import { C, PAGE, t, m$, table, header, footer } from './common.js';

const ESTADO = { borrador: 'Borrador', liquidada: 'Liquidada', pagada: 'Pagada' };

/** Resumen de la nómina (horizontal): una fila por empleado + totales. */
export function buildPayrollSummaryPDF(J, run, estudio = {}, userName = '') {
  const doc = new J({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W = PAGE.h;
  let y = header(doc, {
    emisor: estudio.razonSocial || userName || APP.name, estudio, titulo: `NÓMINA - ${run.label.toUpperCase()}`,
    lineas: [`${tipoLabel(run.tipo)} | Estado: ${ESTADO[run.estado]}`, `Período: ${dateAR(run.desde)} al ${dateAR(run.hasta)}${run.fechaPago ? ` | Pago: ${dateAR(run.fechaPago)}` : ''}`],
  }, true);
  const tt = run.totals;
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...C.muted);
  doc.text(t(`${tt.empleados} empleados  |  Pagado ${m$(tt.pagado)}  |  Pendiente ${m$(tt.pendiente)}`), PAGE.m, y);
  y += 3;

  table(doc, {
    startY: y,
    head: [['Leg.', 'Apellido y nombre', 'CUIL / DNI', 'Remunerativo', 'No rem.', 'Bruto', 'Descuentos', 'Neto', 'Contrib. patr.', 'Costo total', 'Pago']],
    body: run.lines.map((l) => [t(l.legajo), t(l.nombre), t(l.cuil || l.dni), m$(l.totals.remunerativo), m$(l.totals.noRemunerativo), m$(l.totals.bruto), m$(l.totals.descuentos), m$(l.totals.neto), m$(l.totals.patronal), m$(l.totals.costo), l.pago.estado === 'pagado' ? `Pagado ${dateAR(l.pago.fecha)}` : 'Pendiente']),
    foot: [['', 'TOTAL', '', m$(tt.remunerativo), m$(tt.noRemunerativo), m$(tt.bruto), m$(tt.descuentos), m$(tt.neto), m$(tt.patronal), m$(tt.costo), '']],
    showFoot: 'lastPage',
    margin: { left: PAGE.m, right: PAGE.m, bottom: 18 },
    styles: { fontSize: 7.2, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 44 }, 2: { cellWidth: 25 }, 10: { cellWidth: 24 } },
    didParseCell: (d) => { if (d.column.index >= 3 && d.column.index <= 9 && d.section !== 'body') d.cell.styles.halign = 'right'; if (d.column.index >= 3 && d.column.index <= 9 && d.section === 'body') d.cell.styles.halign = 'right'; },
  });
  footer(doc, 'Contribuciones patronales estimadas según porcentajes configurados. Documento interno de gestión: no reemplaza declaraciones juradas ni el Libro de Sueldos Digital.', true);
  return doc;
}
