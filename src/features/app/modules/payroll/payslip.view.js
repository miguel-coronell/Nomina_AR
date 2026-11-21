import { html, raw } from '../../../../core/html.js';
import { money, dateAR, percent, number } from '../../../../core/format.js';
import { montoEnLetras } from '../../../../core/number-words.js';
import { CONVENIOS } from '../../../../domain/legal/articles.js';
import { calcAntiguedad } from '../../../../domain/liquidation/rules/antiguedad.js';
import { costoLaboral, estiloGrafico } from '../../../../domain/payroll/costo.js';
import { depositoTexto } from '../../../../services/pdf/payslip.pdf.js';
import { patronalesDe } from '../../../../domain/payroll/engine.js';
import { APP } from '../../../../config/app.config.js';
import { formatoRecibo, conceptoRecibo } from '../../../../domain/payroll/clasico.js';
import { getFirmas } from '../../../../services/firmas.service.js';
import { payslipClasicoHTML } from './payslip-clasico.view.js';
import { logoImg, seccion, contribucionesHTML, resumenCostoHTML, datosHTML } from '../../shared/receipt-parts.js';

const MEDIOS = { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro medio' };
export const medioLabel = (m) => MEDIOS[m] || m || '—';
const mask = (cbu) => (cbu ? `${'•'.repeat(Math.max(0, cbu.length - 4))}${cbu.slice(-4)}` : '');
const q = (v) => (v === undefined || v === null || v === '' ? '' : number(v));

/** Recibo de haberes (art. 140 LCT, Ley 27.802; Decreto 407/2026): 4 secciones + resumen del costo laboral. */
const firmaStd = (f, label) => html`<div class="sg">${f?.img ? html`<img src="${f.img}" alt="Firma">` : ''}<span>${label}</span></div>`;

export function payslipHTML(run, l, estudio = {}, userName = '') {
  if (formatoRecibo(estudio) === 'clasico' && l.snap.regimen !== 'pasantia') return payslipClasicoHTML(run, l, estudio, userName);
  const costo = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias || 0, deducciones: l.deducciones, patronales: l.patronales || patronalesDe(l.snap, run.params || {}), neto: l.totals.neto, estilo: estiloGrafico(estudio) });
  const pas = l.snap.regimen === 'pasantia';
  const pagado = l.pago.estado === 'pagado';
  const fin = l.snap.fechaEgreso && l.snap.fechaEgreso < run.hasta ? l.snap.fechaEgreso : run.hasta;
  const antig = l.snap.fechaIngreso <= fin ? calcAntiguedad(l.snap.fechaIngreso, fin).texto : '—';
  const emisor = estudio.razonSocial || userName || APP.name;

  return html`
  <div class="receipt payslip">
    <div class="r-head">
      <div class="r-brand">${logoImg(estudio)}<div><h2>${emisor}</h2>
        ${estudio.cuit ? html`<small>CUIT: ${estudio.cuit}</small>` : ''}${estudio.domicilio ? html`<small>${estudio.domicilio}</small>` : ''}${estudio.matricula ? html`<small>Matrícula: ${estudio.matricula}</small>` : ''}</div></div>
      <div class="r-title"><strong>${pas ? 'ASIGNACIÓN ESTÍMULO' : 'RECIBO DE HABERES'}</strong><small>${pas ? 'Pasantía educativa · Ley 26.427' : 'Art. 140 LCT · Decreto 407/2026'}</small><small>${run.label}</small><small>Período: ${dateAR(run.desde)} al ${dateAR(run.hasta)}</small></div>
    </div>

    ${seccion(1, 'IDENTIFICACIÓN: EMPLEADOR Y TRABAJADOR')}
    ${datosHTML([
      ['Empleador', emisor], ['CUIT', estudio.cuit], ['Domicilio', estudio.domicilio], ['Período liquidado', `${run.label} (${dateAR(run.desde)} al ${dateAR(run.hasta)})`],
      [pas ? 'Pasante' : 'Trabajador', l.nombre], ['CUIL', l.cuil], ['Categoría / tarea', l.categoria], [pas ? 'Inicio de pasantía' : 'Fecha de ingreso', pas ? dateAR(l.snap.fechaIngreso) : `${dateAR(l.snap.fechaIngreso)} (antig. ${antig})`],
      ...(pas ? [['Institución educativa', l.institucion], ['Carrera', l.carrera], ['Convenio de referencia', CONVENIOS.find((c) => c.id === l.convenio)?.nombre || l.convenio], ['Asignación mensual', money(l.snap.sueldo)]]
        : [['Convenio', CONVENIOS.find((c) => c.id === l.convenio)?.nombre || l.convenio], l.snap.modalidad === 'hora' ? ['Valor hora', money(l.snap.valorHora)] : ['Remuneración', money(l.snap.sueldo)]]),
      ['Lugar de pago', run.lugarPago || estudio.lugarPago], ['Fecha de pago', pagado ? dateAR(l.pago.fecha) : run.fechaPago ? `${dateAR(run.fechaPago)} (prevista)` : ''],
      ['Forma de pago', pagado ? medioLabel(l.pago.medio) : l.cbu ? 'Depósito en cuenta bancaria' : ''], ['Cuenta', [l.banco, l.cbu && `CBU ${mask(l.cbu)}`].filter(Boolean).join(' · ')],
    ])}
    <div class="r-data r-wide"><div><b>Último depósito de aportes (art. 12 Dto.-ley 17.250/67)</b><span>${depositoTexto(run.deposito)}</span></div></div>

    ${seccion(2, pas ? 'CONTRIBUCIONES A CARGO DE LA EMPRESA (obra social y ART)' : 'CONTRIBUCIONES A CARGO DEL EMPLEADOR (art. 140, inc. j)')}
    ${contribucionesHTML(costo)}

    ${seccion(3, 'REMUNERACIÓN BRUTA Y DEDUCCIONES')}
    <table class="r-tbl">
      <thead><tr><th>Concepto</th><th class="num">Cant.</th><th>Un.</th><th class="num">Base de cálculo</th><th class="num">Rem. c/ aportes</th><th class="num">Rem. s/ aportes</th><th class="num">Deducciones</th></tr></thead>
      <tbody>
        ${l.rubros.filter((r) => r.tipo === 'remunerativo').map((r) => html`<tr><td>${conceptoRecibo(l, r).concepto}</td><td class="num">${q(r.cant)}</td><td>${r.unidad || ''}</td><td class="num">${r.base != null ? money(r.base) : ''}</td><td class="num">${money(r.amount)}</td><td></td><td></td></tr>`)}
        ${l.rubros.filter((r) => r.tipo === 'no_remunerativo').map((r) => html`<tr><td>${conceptoRecibo(l, r).concepto}</td><td class="num">${q(r.cant)}</td><td>${r.unidad || ''}</td><td class="num">${r.base != null ? money(r.base) : ''}</td><td></td><td class="num">${money(r.amount)}</td><td></td></tr>`)}
        ${l.deducciones.map((d) => html`<tr><td>${conceptoRecibo(l, d, true).concepto}</td><td class="num">${d.pct != null ? q(d.pct) : q(d.cant)}</td><td>${d.pct != null ? '%' : d.unidad || ''}</td><td class="num">${d.base != null ? money(d.base) : ''}</td><td></td><td></td><td class="num">${money(d.amount)}</td></tr>`)}
      </tbody>
      <tfoot><tr class="total"><td colspan="4">Totales</td><td class="num">${money(l.totals.remunerativo)}</td><td class="num">${money(l.totals.noRemunerativo)}</td><td class="num">${money(l.totals.descuentos)}</td></tr></tfoot>
    </table>


    ${seccion(4, 'REMUNERACIÓN NETA')}
    <div class="neto"><span>NETO A COBRAR</span><span>${money(l.totals.neto)}</span></div>
    <p class="letras">${montoEnLetras(l.totals.neto)}</p>
    ${l.novedades?.nota ? html`<p class="refs"><strong>Observaciones:</strong> ${l.novedades.nota}</p>` : ''}

    ${seccion(null, 'RESUMEN DE LA COMPOSICIÓN DEL COSTO LABORAL TOTAL (por rubro)')}
    ${resumenCostoHTML(costo)}

    <div class="sign">${firmaStd(getFirmas(run, l).empleador, 'Firma del empleador')}${firmaStd(getFirmas(run, l).empleado, 'Firma del trabajador')}</div>
    <p class="disclaimer">${pas ? 'Pasantía educativa (Ley 26.427): no genera relación laboral; la asignación estímulo es no remunerativa.' : 'Recibo de haberes conforme art. 140 LCT (texto Ley 27.802) y Decreto 407/2026.'} Se confecciona en doble ejemplar. Generado con ${APP.name} ${APP.edition}.</p>
  </div>`;
}
