/**
 * RECIBO DE HABERES (art. 140 LCT, texto Ley 27.802; Decreto 407/2026).
 * Estructura: 1) identificación  2) contribuciones del empleador  3) remuneración bruta y
 * deducciones  4) remuneración neta  + resumen del costo laboral total.
 */
import { dateAR, number } from '../../core/format.js';
import { montoEnLetras } from '../../core/number-words.js';
import { CONVENIOS } from '../../domain/legal/articles.js';
import { calcAntiguedad } from '../../domain/liquidation/rules/antiguedad.js';
import { costoLaboral, estiloGrafico } from '../../domain/payroll/costo.js';
import { patronalesDe } from '../../domain/payroll/engine.js';
import { APP } from '../../config/app.config.js';
import { C, PAGE, D, fs, fitK, t, m$, table, header, section, infoBox, netoBar, paragraph, signatures, tablaContribuciones, resumenCosto, footer } from './common.js';

const MEDIOS = { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro medio' };
const mask = (cbu) => (cbu ? `${'*'.repeat(Math.max(0, cbu.length - 4))}${cbu.slice(-4)}` : '');
const qty = (v) => (v === undefined || v === null || v === '' ? '' : number(v));

export function depositoTexto(dep) {
  if (!dep || (!dep.periodo && !dep.fecha && !dep.banco)) return 'Período ______ | Fecha ____/____/______ | Banco ____________';
  return `Período ${dep.periodo || '-'} | depositado el ${dep.fecha ? dateAR(dep.fecha) : '-'} | ${dep.banco || '-'}`;
}

/** Dibuja UN recibo en la página actual de `doc` (usa la densidad D.k vigente). */
function drawPayslip(doc, run, l, estudio, userName) {
  const params = run.params || {};
  const costo = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias || 0, deducciones: l.deducciones, patronales: patronalesDe(l.snap, params), estilo: estiloGrafico(estudio) });
  const pas = l.snap.regimen === 'pasantia';
  const pagado = l.pago.estado === 'pagado';
  const lugar = run.lugarPago || estudio.lugarPago;
  const fin = l.snap.fechaEgreso && l.snap.fechaEgreso < run.hasta ? l.snap.fechaEgreso : run.hasta;
  const antig = l.snap.fechaIngreso <= fin ? calcAntiguedad(l.snap.fechaIngreso, fin).texto : '-';

  let y = header(doc, {
    emisor: estudio.razonSocial || userName || APP.name, estudio, titulo: pas ? 'ASIGNACIÓN ESTÍMULO' : 'RECIBO DE HABERES',
    subtitulo: pas ? 'Pasantía educativa - Ley 26.427' : 'Art. 140 LCT - Decreto 407/2026', lineas: [`${run.label}`, `Período: ${dateAR(run.desde)} al ${dateAR(run.hasta)}`],
  });

  y = section(doc, y, 'IDENTIFICACIÓN: EMPLEADOR Y TRABAJADOR', 1);
  y = infoBox(doc, y, [
    ['Empleador', estudio.razonSocial || userName], ['CUIT', estudio.cuit],
    ['Domicilio', estudio.domicilio], ['Período liquidado', `${run.label} (${dateAR(run.desde)} al ${dateAR(run.hasta)})`],
    [pas ? 'Pasante' : 'Trabajador', l.nombre], ['CUIL', l.cuil],
    ['Categoría / tarea', l.categoria], [pas ? 'Inicio de pasantía' : 'Fecha de ingreso', pas ? dateAR(l.snap.fechaIngreso) : `${dateAR(l.snap.fechaIngreso)} (antig. ${antig})`],
    ...(pas ? [['Institución educativa', l.institucion], ['Carrera', l.carrera], ['Convenio de referencia', CONVENIOS.find((c) => c.id === l.convenio)?.nombre || l.convenio], ['Asignación mensual', m$(l.snap.sueldo)]]
      : [['Convenio', CONVENIOS.find((c) => c.id === l.convenio)?.nombre || l.convenio], l.snap.modalidad === 'hora' ? ['Valor hora', m$(l.snap.valorHora)] : ['Remuneración', m$(l.snap.sueldo)]]),
    ['Lugar de pago', lugar], ['Fecha de pago', pagado ? dateAR(l.pago.fecha) : run.fechaPago ? `${dateAR(run.fechaPago)} (prevista)` : ''],
    ['Forma de pago', pagado ? (MEDIOS[l.pago.medio] || l.pago.medio) : (l.cbu ? 'Depósito en cuenta bancaria' : '')], ['Cuenta', [l.banco, l.cbu && `CBU ${mask(l.cbu)}`].filter(Boolean).join(' - ')],
  ]);
  y = table(doc, {
    startY: y, body: [['Último depósito de aportes (art. 12 Dto.-ley 17.250/67)', t(depositoTexto(run.deposito))]],
    styles: { fontSize: fs(7.2) }, columnStyles: { 0: { fontStyle: 'bold', textColor: C.muted, fillColor: C.soft, cellWidth: 70 } },
  }) + 1.5;

  y = section(doc, y, pas ? 'CONTRIBUCIONES A CARGO DE LA EMPRESA (obra social y ART)' : 'CONTRIBUCIONES A CARGO DEL EMPLEADOR (art. 140, inc. j)', 2);
  y = tablaContribuciones(doc, y, costo);

  y = section(doc, y, 'REMUNERACIÓN BRUTA Y DEDUCCIONES', 3);
  const body = [
    ...l.rubros.filter((r) => r.tipo === 'remunerativo').map((r) => [t(r.label), qty(r.cant), r.unidad || '', r.base != null ? m$(r.base) : '', m$(r.amount), '', '']),
    ...l.rubros.filter((r) => r.tipo === 'no_remunerativo').map((r) => [t(r.label), qty(r.cant), r.unidad || '', r.base != null ? m$(r.base) : '', '', m$(r.amount), '']),
    ...l.deducciones.map((d) => [t(d.label), d.pct != null ? qty(d.pct) : qty(d.cant), d.pct != null ? '%' : d.unidad || '', d.base != null ? m$(d.base) : '', '', '', m$(d.amount)]),
  ];
  y = table(doc, {
    startY: y, head: [['Concepto', 'Cant.', 'Un.', 'Base de cálculo', 'Rem. c/ aportes', 'Rem. s/ aportes', 'Deducciones']], body,
    foot: [['Totales', '', '', '', m$(l.totals.remunerativo), m$(l.totals.noRemunerativo), m$(l.totals.descuentos)]],
    columnStyles: { 0: { cellWidth: 56 }, 1: { halign: 'right', cellWidth: 12 }, 2: { cellWidth: 9 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 26 }, 5: { halign: 'right', cellWidth: 26 }, 6: { halign: 'right', cellWidth: 27 } },
    didParseCell: (d) => { if ((d.section === 'head' || d.section === 'foot') && d.column.index > 0) d.cell.styles.halign = d.column.index === 2 ? 'left' : 'right'; },
  }) + 1.5;


  y = section(doc, y, 'REMUNERACIÓN NETA', 4);
  y = netoBar(doc, y, l.totals.neto) + 4 * D.k;
  y = paragraph(doc, y, { text: montoEnLetras(l.totals.neto), italic: true, size: 8 });
  if (l.novedades?.nota) y = paragraph(doc, y, { label: 'Observaciones', text: l.novedades.nota, size: 7.5 });

  y = resumenCosto(doc, y + 0.5, costo) + 1;
  signatures(doc, y, 'Firma del empleador', 'Firma del trabajador');
}

/** Una página por empleado; cada recibo se comprime lo necesario para entrar completo (firma incluida). */
export function buildPayslipsPDF(J, run, lines, estudio = {}, userName = '') {
  const doc = new J({ unit: 'mm', format: 'a4' });
  lines.forEach((l, i) => {
    const k = fitK(J, (tmp) => drawPayslip(tmp, run, l, estudio, userName));
    D.k = k;
    if (i) doc.addPage();
    drawPayslip(doc, run, l, estudio, userName);
    D.k = 1;
  });
  const soloPas = lines.length > 0 && lines.every((l) => l.snap.regimen === 'pasantia');
  footer(doc, soloPas
    ? `Pasantía educativa (Ley 26.427): no genera relación laboral; la asignación estímulo es no remunerativa. Se confecciona en doble ejemplar. Generado con ${APP.name} ${APP.edition}.`
    : `Recibo de haberes conforme art. 140 LCT (texto Ley 27.802) y Decreto 407/2026. Se confecciona en doble ejemplar. Generado con ${APP.name} ${APP.edition}.`);
  return doc;
}
