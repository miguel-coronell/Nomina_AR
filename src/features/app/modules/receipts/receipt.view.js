import { html, raw } from '../../../../core/html.js';
import { money, dateAR, dateTimeAR, percent } from '../../../../core/format.js';
import { addBusinessDays } from '../../../../core/dates.js';
import { montoEnLetras } from '../../../../core/number-words.js';
import { motivoLabel } from '../../../../domain/legal/params.js';
import { CONVENIOS, AVISO_LEGAL } from '../../../../domain/legal/articles.js';
import { costoLaboral, estiloGrafico } from '../../../../domain/payroll/costo.js';
import { depositoTexto } from '../../../../services/pdf/payslip.pdf.js';
import { APP } from '../../../../config/app.config.js';
import { logoImg, seccion, contribucionesHTML, resumenCostoHTML, datosHTML } from '../../shared/receipt-parts.js';

const FORMAS = { transferencia: 'Transferencia bancaria', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro medio' };

/**
 * Liquidación final en pantalla/impresión. Misma estructura que el PDF:
 * identificación, contribuciones, liquidación, neto, resumen del costo, plazos y recibí.
 */
export function receiptHTML(rec, estudio = {}, userName = '', extra = {}) {
  const { input, antiguedad: a, totals: t } = rec;
  const emisor = estudio.razonSocial || userName || APP.name;
  const pago = rec.pago || {};
  const costo = costoLaboral({ bruto: t.bruto, baseAportes: rec.deducciones[0]?.base || 0, deducciones: rec.deducciones, patronales: rec.params?.patronales || extra.patronales || {}, estilo: estiloGrafico(estudio) });
  const col = (r) => (r.tipo === 'remunerativo' ? 'rem' : 'no');
  const fila = (r) => html`<tr><td>${r.label}${r.detail ? html`<small>${r.detail}</small>` : ''}</td><td class="ley">${r.ref}</td>
    <td class="num">${col(r) === 'rem' ? money(r.amount) : ''}</td><td class="num">${col(r) === 'no' ? money(r.amount) : ''}</td><td></td></tr>`;
  const multas = rec.rubros.filter((r) => r.tipo === 'multa');

  return html`
  <div class="receipt">
    <div class="r-head">
      <div class="r-brand">${logoImg(estudio)}<div><h2>${emisor}</h2>
        ${estudio.cuit ? html`<small>CUIT: ${estudio.cuit}</small>` : ''}${estudio.domicilio ? html`<small>${estudio.domicilio}</small>` : ''}${estudio.matricula ? html`<small>Matrícula: ${estudio.matricula}</small>` : ''}</div></div>
      <div class="r-title"><strong>LIQUIDACIÓN FINAL</strong><small>Extinción del contrato de trabajo</small>
        <small>Emitida: ${dateTimeAR(rec.createdAt || new Date().toISOString())}</small>${rec.id ? html`<small>N.º ${String(rec.id).slice(-8).toUpperCase()}</small>` : ''}</div>
    </div>

    ${seccion(1, 'IDENTIFICACIÓN: EMPLEADOR, TRABAJADOR Y RELACIÓN LABORAL')}
    ${datosHTML([
      ['Empleador', emisor], ['CUIT', estudio.cuit], ['Domicilio', estudio.domicilio], ['Lugar de pago', pago.lugar || estudio.lugarPago],
      ['Trabajador', rec.employeeName || input.nombre], ['CUIL', rec.employeeCuil], ['DNI', rec.employeeDni], ['Legajo', rec.employeeLegajo],
      ['Categoría / tarea', rec.categoria], ['Convenio', CONVENIOS.find((c) => c.id === rec.convenio)?.nombre || rec.convenio],
      ['Fecha de ingreso', dateAR(input.fechaIngreso)], ['Fecha de egreso', dateAR(input.fechaEgreso)],
      ['Antigüedad', a.texto], ['Causa de extinción', motivoLabel(input.motivo)],
      ['Mejor remuneración', money(input.sueldo)], ['Fecha de pago', pago.fecha ? dateAR(pago.fecha) : ''],
      ['Forma de pago', FORMAS[pago.forma] || pago.forma], ['Marco legal', rec.marco?.ley27802 ? 'Ley 27.802' : rec.marco?.leyBases ? 'Ley 27.742' : 'Régimen anterior'],
    ])}
    <div class="r-data r-wide"><div><b>Último depósito de aportes (art. 12 Dto.-ley 17.250/67)</b><span>${depositoTexto(rec.deposito)}</span></div></div>

    ${seccion(2, 'CONTRIBUCIONES A CARGO DEL EMPLEADOR (sobre conceptos remunerativos)')}
    ${contribucionesHTML(costo)}

    ${seccion(3, 'REMUNERACIÓN BRUTA, INDEMNIZACIONES Y DEDUCCIONES')}
    <table class="r-tbl">
      <thead><tr><th>Concepto</th><th>Base legal</th><th class="num">Remunerativo</th><th class="num">No remunerativo</th><th class="num">Deducciones</th></tr></thead>
      <tbody>
        ${rec.rubros.filter((r) => r.tipo === 'remunerativo').map(fila)}
        ${rec.rubros.filter((r) => r.tipo === 'indemnizatorio').map(fila)}
        ${multas.length ? html`<tr><td colspan="5"><strong>Sanciones / incrementos</strong></td></tr>${multas.map((r) => html`<tr><td>${r.label}</td><td class="ley">${r.ref}</td><td></td><td class="num">${money(r.amount)}</td><td></td></tr>`)}` : ''}
        ${rec.deducciones.map((d) => html`<tr><td>${d.label} <small class="inl">${percent(d.pct)} s/ ${money(d.base)}</small></td><td class="ley">Aportes de ley</td><td></td><td></td><td class="num">${money(d.amount)}</td></tr>`)}
      </tbody>
      <tfoot><tr class="total"><td colspan="2">Totales</td><td class="num">${money(t.remunerativo)}</td><td class="num">${money(t.indemnizatorio + t.multas)}</td><td class="num">${money(t.deducciones)}</td></tr></tfoot>
    </table>

    ${seccion(4, 'REMUNERACIÓN NETA')}
    <div class="neto"><span>NETO A COBRAR</span><span>${money(t.neto)}</span></div>
    <p class="letras">${montoEnLetras(t.neto)}</p>
    ${rec.warnings?.length ? html`<p class="refs"><strong>Observaciones:</strong> ${rec.warnings.join(' ')}</p>` : ''}
    ${rec.notas ? html`<p class="refs"><strong>Notas:</strong> ${rec.notas}</p>` : ''}
    <p class="refs"><strong>Base legal:</strong> ${rec.refs.join(' · ')}</p>

    ${seccion(null, 'RESUMEN DE LA COMPOSICIÓN DEL COSTO LABORAL TOTAL (por rubro)')}
    ${resumenCostoHTML(costo)}

    ${seccion(5, 'PLAZOS Y DOCUMENTACIÓN A ENTREGAR')}
    <ul class="r-list">
      <li><b>Plazo de pago:</b> 4 días hábiles desde la extinción (arts. 128 y 255 bis LCT). Fecha límite estimada: <b>${dateAR(addBusinessDays(input.fechaEgreso, 4))}</b> (sin considerar feriados).</li>
      <li><b>Documentación:</b> ☐ Constancia de baja en ARCA · ☐ Certificado art. 80 LCT (ARCA; plazo informado: 45 días hábiles) · ☐ Certificación de Servicios y Remuneraciones (ANSES, PS 6.2) · ☐ Liquidación final.</li>
    </ul>

    ${seccion(6, 'RECIBÍ')}
    <p class="recibi">Recibí de <b>${emisor}</b>${estudio.cuit ? ` (CUIT ${estudio.cuit})` : ''} la suma de ${montoEnLetras(t.neto).replace(/^Son pesos /, 'pesos ').replace(/\.$/, '')} (${money(t.neto)}), en concepto de liquidación final por extinción del contrato de trabajo (${motivoLabel(input.motivo)}), imputable a los conceptos detallados. El pago insuficiente se considera hecho a cuenta del total adeudado (art. 260 LCT).</p>
    <div class="sign"><div>Firma del empleador</div><div>Firma, aclaración y DNI del trabajador</div></div>
    <p class="disclaimer">Liquidación final conforme arts. 128, 140 y 255 bis LCT y Decreto 407/2026. ${raw(AVISO_LEGAL)} Generado con ${APP.name} ${APP.edition}.</p>
  </div>`;
}
