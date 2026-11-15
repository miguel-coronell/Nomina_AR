import { toCSV, downloadFile } from '../../../../core/csv.js';
import { downloadXLSX } from '../../../../core/xlsx.js';
import { dateAR } from '../../../../core/format.js';
import { medioLabel } from './payslip.view.js';

const slug = (run) => run.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();

const pagosRows = (run) => run.lines.map((l) => ({
  'Apellido y nombre': l.nombre, CUIL: l.cuil, DNI: l.dni, Banco: l.banco, CBU: l.cbu, 'Importe neto': l.totals.neto,
  Estado: l.pago.estado === 'pagado' ? 'Pagado' : 'Pendiente', 'Fecha de pago': l.pago.fecha ? dateAR(l.pago.fecha) : '', Medio: l.pago.medio ? medioLabel(l.pago.medio) : '',
}));

export async function exportNominaXLSX(run) {
  const nomina = run.lines.map((l) => ({
    Legajo: l.legajo, 'Apellido y nombre': l.nombre, DNI: l.dni, CUIL: l.cuil, Categoría: l.categoria,
    Remunerativo: l.totals.remunerativo, 'No remunerativo': l.totals.noRemunerativo, Bruto: l.totals.bruto,
    'Aportes y descuentos': l.totals.descuentos, Neto: l.totals.neto, 'Contribuciones patronales': l.totals.patronal, 'Costo total': l.totals.costo,
  }));
  const t = run.totals;
  nomina.push({ Legajo: '', 'Apellido y nombre': 'TOTAL', DNI: '', CUIL: '', Categoría: '', Remunerativo: t.remunerativo, 'No remunerativo': t.noRemunerativo, Bruto: t.bruto, 'Aportes y descuentos': t.descuentos, Neto: t.neto, 'Contribuciones patronales': t.patronal, 'Costo total': t.costo });
  const detalle = run.lines.flatMap((l) => [
    ...l.rubros.map((r) => ({ Empleado: l.nombre, Concepto: r.label, Tipo: r.tipo === 'remunerativo' ? 'Remunerativo' : 'No remunerativo', Importe: r.amount })),
    ...l.deducciones.map((d) => ({ Empleado: l.nombre, Concepto: d.label, Tipo: 'Descuento', Importe: -d.amount })),
  ]);
  await downloadXLSX(`nomina_${slug(run)}.xlsx`, [
    { name: 'Nómina', rows: nomina, widths: [8, 30, 12, 15, 18, 15, 15, 15, 18, 15, 20, 15] },
    { name: 'Pagos', rows: pagosRows(run), widths: [30, 15, 12, 18, 26, 15, 12, 14, 18] },
    { name: 'Detalle de conceptos', rows: detalle, widths: [30, 46, 16, 15] },
  ]);
}

export function exportPagosCSV(run) {
  const rows = pagosRows(run);
  const cols = Object.keys(rows[0] || {}).map((k) => ({ label: k, value: (r) => r[k] }));
  downloadFile(`planilla_pagos_${slug(run)}.csv`, toCSV(rows, cols));
}
