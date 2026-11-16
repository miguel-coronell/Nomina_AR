/**
 * API pública de generación de PDF. Las librerías (jsPDF + autoTable) se descargan
 * solo la primera vez que se pide un PDF.
 */
import { loadScript } from '../../core/dom.js';
import { buildLiquidacionPDF } from './liquidation.pdf.js';
import { buildPayslipsPDF } from './payslip.pdf.js';
import { buildPayrollSummaryPDF } from './payroll-summary.pdf.js';
import { buildFichaPDF } from './employee-ficha.pdf.js';
import { slug } from './common.js';

const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';

async function lib() {
  if (!globalThis.jspdf?.jsPDF) await loadScript(JSPDF);
  const J = globalThis.jspdf?.jsPDF;
  if (!J) throw new Error('No se pudo cargar el generador de PDF.');
  if (!J.API.autoTable) await loadScript(AUTOTABLE);
  if (!J.API.autoTable) throw new Error('No se pudo cargar el generador de tablas PDF.');
  return J;
}

export async function downloadLiquidacionPDF(rec, estudio, userName, extra = {}) {
  const doc = buildLiquidacionPDF(await lib(), rec, estudio, userName, extra);
  doc.save(`liquidacion_${slug(rec.employeeName || 'final')}_${rec.input.fechaEgreso}.pdf`);
}

export async function downloadPayslipsPDF(run, lines, estudio, userName) {
  const doc = buildPayslipsPDF(await lib(), run, lines, estudio, userName);
  const name = lines.length === 1 ? `recibo_${slug(run.label)}_${slug(lines[0].nombre)}` : `recibos_${slug(run.label)}`;
  doc.save(`${name}.pdf`);
}

export async function downloadPayrollSummaryPDF(run, estudio, userName) {
  buildPayrollSummaryPDF(await lib(), run, estudio, userName).save(`resumen_nomina_${slug(run.label)}.pdf`);
}

/* ---- Versiones que devuelven el archivo (para compartir) en lugar de descargarlo ---- */
const asFile = (doc, filename) => ({ blob: doc.output('blob'), filename });

export async function liquidacionPDFFile(rec, estudio, userName, extra = {}) {
  return asFile(buildLiquidacionPDF(await lib(), rec, estudio, userName, extra), `liquidacion_${slug(rec.employeeName || 'final')}_${rec.input.fechaEgreso}.pdf`);
}

export async function payslipPDFFile(run, line, estudio, userName) {
  return asFile(buildPayslipsPDF(await lib(), run, [line], estudio, userName), `recibo_${slug(run.label)}_${slug(line.nombre)}.pdf`);
}

/** Ficha de personal: devuelve { blob, filename } para abrirla en pestaña nueva (imprimir) o descargarla. */
export async function fichaPDFFile(data) {
  return asFile(buildFichaPDF(await lib(), data), `ficha_${slug(data.emp.nombre || 'empleado')}.pdf`);
}
