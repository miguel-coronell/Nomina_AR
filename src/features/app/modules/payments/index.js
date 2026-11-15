import { html } from '../../../../core/html.js';
import { $, $$, on } from '../../../../core/dom.js';
import { money, dateAR, initials } from '../../../../core/format.js';
import { dcard, avatarLead } from '../../../../core/ui/cards.js';
import { sharePayslip, shareBtn } from '../../shared/share.dialog.js';
import { statValue } from '../../../../core/ui/stat.js';
import { pagoDialog } from '../payroll/dialogs.js';
import { exportPagosCSV } from '../payroll/export.js';

const MEDIO = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', otro: 'Otro' };

export default {
  id: 'pagos', title: 'Pagos', icon: 'fa-credit-card', group: 'Principal',

  async mount(el, ctx, params) {
    let runs = (await ctx.services.payroll.list()).filter((r) => r.estado !== 'borrador');
    if (!runs.length) {
      el.innerHTML = html`
        <div class="page-head"><div><h2>Pagos y Transferencias</h2><p>Gestioná y procesá los pagos de haberes del período.</p></div></div>
        <div class="card"><div class="card-body empty"><i class="fas fa-credit-card"></i><h4>No hay nóminas liquidadas</h4>
        <p>Liquidá una nómina para habilitar el pago de haberes.</p><a class="btn btn-primary" style="margin-top:1rem" href="#/nomina">Ir a Liquidaciones</a></div></div>`;
      return;
    }
    let run = runs.find((r) => r.id === params.get('id')) || runs[0];
    const sel = new Set();

    const draw = () => {
      const t = run.totals, pend = run.lines.filter((l) => l.pago.estado !== 'pagado');
      const medios = [...new Set(run.lines.filter((l) => l.pago.medio).map((l) => MEDIO[l.pago.medio] || l.pago.medio))];
      el.innerHTML = html`
        <div class="page-head">
          <div><h2>Pagos y Transferencias</h2><p>Gestioná y procesá los pagos de haberes del período.</p></div>
          <div class="page-actions">
            <button class="btn btn-outline" data-action="csv"><i class="fas fa-file-csv"></i> Planilla de pagos</button>
            <button class="btn btn-primary" data-action="pay" ${sel.size ? '' : 'disabled'}><i class="fas fa-check"></i> Registrar pago${sel.size ? ' (' + sel.size + ')' : ''}</button>
          </div>
        </div>
        <div class="grid grid-4 mb">
          <div class="card stat"><div class="ico violet"><i class="fas fa-dollar-sign"></i></div><div>${statValue(money(t.neto))}<small>Total a pagar</small></div></div>
          <div class="card stat"><div class="ico amber"><i class="fas fa-hourglass-half"></i></div><div><strong>${pend.length}</strong><small>Pagos pendientes</small></div></div>
          <div class="card stat"><div class="ico green"><i class="fas fa-circle-check"></i></div><div>${statValue(money(t.pagado))}<small>Ya pagado (${t.pagados}/${t.empleados})</small></div></div>
          <div class="card stat"><div class="ico blue"><i class="fas fa-calendar-day"></i></div><div><strong>${run.fechaPago ? dateAR(run.fechaPago) : '—'}</strong><small>Fecha de pago</small></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3><i class="fas fa-credit-card" style="color:var(--primary)"></i> Procesar pagos del período</h3>
            <select class="select" id="p-run" style="width:auto;min-width:230px">${runs.map((r) => html`<option value="${r.id}" ${r.id === run.id ? 'selected' : ''}>${r.label}</option>`)}</select></div>
          <div class="card-body">
            <div class="table-wrap has-cards"><table class="table">
              <thead><tr><th style="width:36px"><input type="checkbox" id="p-all" ${pend.length && pend.every((l) => sel.has(l.employeeId)) ? 'checked' : ''}></th><th>Legajo</th><th>Empleado</th><th>Banco</th><th>CBU/CVU</th><th class="num">Monto neto</th><th>Estado</th><th></th></tr></thead>
              <tbody>${run.lines.map((l) => html`<tr>
                <td><input type="checkbox" data-sel="${l.employeeId}" ${sel.has(l.employeeId) ? 'checked' : ''} ${l.pago.estado === 'pagado' ? 'disabled' : ''}></td>
                <td>${l.legajo || '—'}</td>
                <td><div style="display:flex;align-items:center;gap:.6rem"><span class="avatar" style="width:32px;height:32px;font-size:.72rem">${initials(l.nombre)}</span><strong>${l.nombre}</strong></div></td>
                <td>${l.banco || '—'}</td><td>${l.cbu || html`<span class="badge badge-warning">Sin CBU</span>`}</td>
                <td class="num"><strong>${money(l.totals.neto)}</strong></td>
                <td>${l.pago.estado === 'pagado'
                  ? html`<span class="badge badge-success"><i class="fas fa-circle-check"></i> Pagado ${dateAR(l.pago.fecha)}</span> <button class="icon-btn" data-undo="${l.employeeId}" title="Revertir pago"><i class="fas fa-rotate-left"></i></button>`
                  : html`<span class="badge badge-warning"><i class="fas fa-clock"></i> Pendiente</span>`}</td>
                <td class="actions"><div class="row-actions">${shareBtn('data-share', l.employeeId)}</div></td></tr>`)}</tbody>
            </table></div>
            <div class="cards-list">${run.lines.map((l) => dcard({
              check: html`<input type="checkbox" class="dcard-check" data-sel="${l.employeeId}" ${sel.has(l.employeeId) ? 'checked' : ''} ${l.pago.estado === 'pagado' ? 'disabled' : ''} aria-label="Seleccionar ${l.nombre}">`,
              lead: avatarLead(l.nombre), title: l.nombre, sub: l.legajo ? `Legajo ${l.legajo}` : '',
              badge: l.pago.estado === 'pagado' ? html`<span class="badge badge-success"><i class="fas fa-circle-check"></i> Pagado</span>` : html`<span class="badge badge-warning"><i class="fas fa-clock"></i> Pendiente</span>`,
              rows: [['fa-building-columns', 'Banco', l.banco || '—'], ['fa-sack-dollar', 'Monto neto', money(l.totals.neto), 'hl'],
                ['fa-hashtag', 'CBU / CVU', l.cbu || html`<span class="badge badge-warning">Sin CBU</span>`, 'wide'],
                ...(l.pago.estado === 'pagado' ? [['fa-calendar-check', 'Pagado el', dateAR(l.pago.fecha), 'wide']] : [])],
              cls: sel.has(l.employeeId) ? 'selected' : '',
              actions: html`${shareBtn('data-share', l.employeeId, { label: true })}${l.pago.estado === 'pagado' ? html`<button class="btn btn-outline btn-sm" data-undo="${l.employeeId}"><i class="fas fa-rotate-left"></i> Revertir</button>` : ''}`,
            }))}</div>
            <button class="btn btn-primary btn-block btn-lg" style="margin-top:1rem" data-action="pay-all" ${pend.length ? '' : 'disabled'}><i class="fas fa-paper-plane"></i> Procesar lote de pagos (${pend.length})</button>
            ${medios.length ? html`<p class="muted-text" style="margin-top:.8rem;font-size:.85rem">Medios usados: ${medios.join(', ')}</p>` : ''}
          </div>
        </div>`;
    };
    draw();

    const refresh = (next) => { run = next; runs = runs.map((r) => (r.id === next.id ? next : r)); sel.clear(); draw(); };
    on(el, 'change', '#p-run', (e) => { run = runs.find((r) => r.id === e.target.value); sel.clear(); draw(); });
    on(el, 'change', '#p-all', (e) => { run.lines.forEach((l) => { if (l.pago.estado !== 'pagado') e.target.checked ? sel.add(l.employeeId) : sel.delete(l.employeeId); }); draw(); });
    on(el, 'change', '[data-sel]', (e, c) => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); draw(); });
    on(el, 'click', '[data-action]', (_, b) => {
      const a = b.dataset.action;
      if (a === 'csv') exportPagosCSV(run);
      const ids = a === 'pay-all' ? run.lines.filter((l) => l.pago.estado !== 'pagado').map((l) => l.employeeId) : [...sel];
      if ((a === 'pay' || a === 'pay-all') && ids.length) pagoDialog(ctx, run, ids, refresh);
    });
    on(el, 'click', '[data-share]', (_, b) => sharePayslip(ctx, run, run.lines.find((l) => l.employeeId === b.dataset.share)));
    on(el, 'click', '[data-undo]', async (_, b) => {
      if (!(await ctx.confirmDialog({ title: 'Revertir pago', message: '¿Marcar este pago como pendiente nuevamente?', confirmText: 'Revertir' }))) return;
      try { refresh(await ctx.services.payroll.revertirPago(run, [b.dataset.undo])); ctx.toast('Pago revertido', 'success'); } catch { ctx.toast('No se pudo revertir.', 'error'); }
    });
  },
};
