/** Calculadora rápida de liquidación (vista previa por empleado). No guarda nada: para guardar se crea la nómina. */
import { html } from '../../../../core/html.js';
import { $, on } from '../../../../core/dom.js';
import { money } from '../../../../core/format.js';
import { describirPeriodo } from '../../../../domain/payroll/periodos.js';
import { nuevaLinea, paramsDe } from '../../../../domain/payroll/run.js';

const NOV = [['hsNormales', 'Horas normales trabajadas', 'hs'], ['he50', 'Horas extras 50%', 'hs'], ['he100', 'Horas extras 100%', 'hs'], ['ausenciasInjustificadas', 'Ausencias injustificadas', 'días'], ['bono', 'Bono / adicional', '$'], ['adelanto', 'Adelantos', '$']];

export function mountQuickCalc(host, ctx, employees, onCreateRun) {
  const list = employees.filter((e) => !e.fechaEgreso);
  if (!list.length) { host.innerHTML = ''; return; }
  const now = new Date(), ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  host.innerHTML = html`
    <div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);margin-bottom:1.2rem">
      <div class="card"><div class="card-header"><h3><i class="fas fa-users" style="color:var(--primary)"></i> Liquidación de sueldos</h3></div>
        <div class="card-body"><form id="qc" class="form-grid" novalidate>
          <div class="field"><label>Empleado</label><select class="select" name="emp">${list.map((e) => html`<option value="${e.id}">${e.nombre}</option>`)}</select></div>
          <div class="field"><label>Período</label><input class="input" type="month" name="ym" value="${ym}"></div>
          ${NOV.map(([k, l, u]) => html`<div class="field" ${k === 'hsNormales' ? 'data-hn' : ''}><label>${l} <small class="muted-text">(${u})</small></label><input class="input" type="number" min="0" step="any" name="${k}" placeholder="0"></div>`)}
          <div class="full"><button type="button" class="btn btn-primary btn-block" data-calc><i class="fas fa-calculator"></i> Calcular liquidación</button></div>
        </form></div></div>
      <div class="card"><div class="card-header"><h3><i class="fas fa-circle-check" style="color:var(--success)"></i> Resultado de la liquidación</h3><span class="badge badge-success">Cálculo actualizado</span></div>
        <div class="card-body" id="qc-out"></div></div>
    </div>`;
  const form = $('#qc', host);
  const calc = () => {
    const d = Object.fromEntries(new FormData(form));
    const emp = list.find((e) => e.id === d.emp);
    $('[data-hn]', host).hidden = emp.modalidad !== 'hora';
    const [y, m] = d.ym.split('-').map(Number);
    const novedades = Object.fromEntries(NOV.map(([k]) => [k, d[k]]));
    const l = nuevaLinea(emp, describirPeriodo({ tipo: 'mensual', year: y, month: m }), paramsDe(ctx.state.settings), novedades);
    const row = (n, v, neg) => html`<div class="qc-row"><span>${n}</span><b class="${neg ? 'neg' : ''}">${neg ? '-' : ''}${money(v)}</b></div>`;
    $('#qc-out', host).innerHTML = html`
      <div class="qc-bruto"><small>Sueldo bruto</small><strong>${money(l.totals.bruto)}</strong></div>
      ${l.rubros.map((r) => row(r.nombre, r.amount))}
      <hr>${l.deducciones.map((r) => row(r.nombre, r.amount, true))}
      <div class="qc-neto"><span>Sueldo neto</span><strong>${money(l.totals.neto)}</strong></div>
      <button class="btn btn-primary btn-block" data-create style="margin-top:1rem"><i class="fas fa-file-invoice-dollar"></i> Crear nómina de ${String(m).padStart(2, '0')}/${y}</button>`;
  };
  calc();
  form.addEventListener('input', calc);
  on(host, 'click', '[data-calc]', calc);
  on(host, 'click', '[data-create]', () => onCreateRun());
}
