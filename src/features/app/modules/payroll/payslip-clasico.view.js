import { html } from '../../../../core/html.js';
import { datosClasico } from '../../../../domain/payroll/clasico.js';
import { getFirmas } from '../../../../services/firmas.service.js';

const firmaDig = (d, original) => { const f = d.firmas?.[original ? 'empleado' : 'empleador']; return f?.img ? html`<img class="rc-sig" src="${f.img}" alt="Firma">` : ''; };

const copia = (d, titulo, original) => html`
  <div class="rc-copy">
    <div class="rc-tag">${titulo}</div>
    <div class="rc-box">
      <div class="rc-head"><div><b class="rc-big">${d.emisor}</b><b>${d.domicilio}</b><b>C.U.I.T.: ${d.cuit}</b><b>C.U.I.L.: ${d.cuil}${d.os ? html`&nbsp;&nbsp;&nbsp;O. S.: ${d.os}` : ''}</b></div>
        <div><b>BANCO: ${d.banco}</b><b>Período: ${d.periodo}</b><b>Condición:</b><b>${d.condicion}</b></div></div>
      <div class="rc-row rc-r1"><span>LEGAJO</span><span>APELLIDO Y NOMBRE</span><span>FECHA DE INGRESO</span><span>N° RECIBO: ${d.nro}</span></div>
      <div class="rc-row rc-r1 rc-val"><span>${d.legajo}</span><span><i>${d.nombre}</i></span><span>${d.ingreso}</span><span>${d.tipo}</span></div>
      <div class="rc-dep"><div><div class="rc-t">ULTIMO DEPOSITO</div><div class="rc-3"><span>FECHA</span><span>LAPSO</span><span>BANCO</span></div><div class="rc-3 rc-n"><span>${d.depFecha}</span><span>${d.depLapso}</span><span>${d.depBanco}</span></div></div>
        <div><div class="rc-3 rc-liq"><span>LIQUIDACION</span><span>BASICO</span><span class="r">${d.basico}</span></div><div class="rc-t">CARGO</div><div class="rc-t rc-cargo">${d.cargo}</div></div></div>
      <table class="rc-tbl"><thead><tr><th>COD.</th><th>CONCEPTO</th><th>C/Hs./%</th><th>REM. C/D</th><th>REM. S/D</th><th>DEDUCCIONES</th></tr></thead>
        <tbody>${d.rows.map((r) => html`<tr><td>${r.cod}</td><td>${r.concepto}</td><td class="r">${r.cant}</td><td class="r">${r.cd}</td><td class="r">${r.sd}</td><td class="r">${r.ded}</td></tr>`)}<tr class="rc-fill"><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>
      <table class="rc-pie"><thead><tr><th>LUGAR DE PAGO</th><th>FECHA</th><th>TOTAL</th><th>TOTAL</th><th>TOTAL</th></tr></thead>
        <tbody><tr><td>${d.lugar}</td><td class="c">${d.fecha}</td><td class="r">${d.totCD}</td><td class="r">${d.totSD}</td><td class="r">${d.totDed}</td></tr></tbody></table>
      <div class="rc-neto"><div>${original ? html`<p>RECIBI CONFORME LA SUMA DE:</p>` : ''}<p>${d.letras}</p></div><div><small>NETO</small><b>${d.neto}</b></div></div>
      <div class="rc-firma"><p>EN CONCEPTO DE REMUNERACIONES CORRESPONDIENTES AL<br>PERIODO ARRIBA INDICADO.</p>
        <div>${firmaDig(d, original)}<span></span><small>${original ? 'FIRMA DEL EMPLEADO' : 'FIRMA DEL EMPLEADOR'}</small></div></div>
    </div>
  </div>`;

/** Hoja A4 horizontal: original y duplicado lado a lado. */
export function payslipClasicoHTML(run, l, estudio = {}, userName = '') {
  const idx = Math.max(0, run.lines.findIndex((x) => x.employeeId === l.employeeId));
  const d = { ...datosClasico(run, l, estudio, userName, idx), firmas: getFirmas(run, l) };
  return html`<div class="rc-sheet">${copia(d, 'ORIGINAL - EMPRESA', true)}${copia(d, 'DUPLICADO - TRABAJADOR', false)}</div>`;
}
