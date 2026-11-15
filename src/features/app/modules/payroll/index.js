import { html } from '../../../../core/html.js';
import { $, $$, on, debounce } from '../../../../core/dom.js';
import { money, dateAR } from '../../../../core/format.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { statValue } from '../../../../core/ui/stat.js';
import { dcard, avatarLead, iconLead, emptyCard } from '../../../../core/ui/cards.js';
import { sharePayslip, shareBatch, shareBtn } from '../../shared/share.dialog.js';
import { tipoLabel } from '../../../../domain/payroll/periodos.js';
import { downloadPayslipsPDF, downloadPayrollSummaryPDF } from '../../../../services/pdf/index.js';
import { newRunDialog, novedadesDialog, pagoDialog, payslipDialog, printAllPayslips, metaDialog } from './dialogs.js';
import { exportNominaXLSX, exportPagosCSV } from './export.js';
import { medioLabel } from './payslip.view.js';
import { mountQuickCalc } from './quick.js';

const ESTADO_TXT = { borrador: 'borrador', liquidada: 'liquidada pago pendiente', pagada: 'pagada' };
const estadoBadge = (run) => {
  if (run.estado === 'borrador') return html`<span class="badge badge-gray"><i class="fas fa-pen-ruler"></i> Borrador</span>`;
  if (run.estado === 'pagada') return html`<span class="badge badge-success"><i class="fas fa-circle-check"></i> Pagada</span>`;
  return run.totals.pagados > 0
    ? html`<span class="badge badge-warning"><i class="fas fa-hourglass-half"></i> Pago parcial</span>`
    : html`<span class="badge badge-warning"><i class="fas fa-clock"></i> Pago pendiente</span>`;
};
const progress = (run) => {
  const pct = run.totals.neto ? Math.round((run.totals.pagado / run.totals.neto) * 100) : 0;
  return html`<div class="progress" title="${pct}% pagado"><i style="width:${pct}%"></i></div>`;
};

/* ============ LISTADO ============ */
async function mountList(el, ctx) {
  const [runs, employees] = await Promise.all([ctx.services.payroll.list(), ctx.services.employees.list()]);
  const pendiente = runs.filter((r) => r.estado === 'liquidada').reduce((a, r) => a + r.totals.pendiente, 0);
  const ult = runs.find((r) => r.estado !== 'borrador') || runs[0];
  const f = { q: '', estado: '' };
  const pager = createPager({ onChange: () => rows() });

  el.innerHTML = html`
    <div class="page-head">
      <div><h2>Gestión de Nómina y Liquidación de Sueldos</h2><p>Calculá, liquidá y pagá los sueldos del período.</p></div>
      <div class="page-actions"><button class="btn btn-primary" data-action="new"><i class="fas fa-plus"></i> Nueva nómina</button></div>
    </div>
    <div class="grid grid-4 mb">
      <div class="card stat"><div class="ico blue"><i class="fas fa-layer-group"></i></div><div><small>Nóminas</small><strong>${runs.length}</strong></div></div>
      <div class="card stat"><div class="ico amber"><i class="fas fa-hourglass-half"></i></div><div><small>Pendiente de pago</small>${statValue(money(pendiente))}</div></div>
      <div class="card stat"><div class="ico green"><i class="fas fa-money-check-dollar"></i></div><div><small>Último neto${ult ? ' · ' + ult.label : ''}</small>${statValue(ult ? money(ult.totals.neto) : '—')}</div></div>
      <div class="card stat"><div class="ico violet"><i class="fas fa-building"></i></div><div><small>Costo laboral último</small>${statValue(ult ? money(ult.totals.costo) : '—')}</div></div>
    </div>
    <div id="quick-calc"></div>
    <div class="card"><div class="card-body">
      ${runs.length ? html`
        <div class="toolbar">
          <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="n-q" type="search" placeholder="Buscar por período, tipo o estado…"></div>
          <select class="select" id="n-estado"><option value="">Todos los estados</option><option value="borrador">Borrador</option><option value="liquidada">Liquidada</option><option value="pagada">Pagada</option></select>
        </div>
        <div class="table-wrap has-cards"><table class="table">
          <thead><tr><th>Período</th><th>Tipo</th><th class="num">Empleados</th><th class="num">Bruto</th><th class="num">Neto</th><th style="min-width:120px">Pagado</th><th>Estado</th><th></th></tr></thead>
          <tbody id="n-body"></tbody></table></div><div class="cards-list" id="n-cards"></div><div id="n-pager"></div>`
        : html`<div class="empty"><i class="fas fa-money-check-dollar"></i><h4>Todavía no creaste nóminas</h4>
          <p>${employees.length ? 'Creá la primera para liquidar los sueldos del período.' : 'Primero cargá o importá tus empleados.'}</p>
          ${employees.length ? html`<button class="btn btn-primary" style="margin-top:1rem" data-action="new">Crear nómina</button>` : html`<a class="btn btn-primary" style="margin-top:1rem" href="#/empleados">Ir a Empleados</a>`}</div>`}
    </div></div>`;

  function rows() {
    const match = matcher(f.q);
    const list = runs.filter((r) => (!f.estado || r.estado === f.estado) && match(r.label, tipoLabel(r.tipo), ESTADO_TXT[r.estado], r.notas));
    const info = pager.apply(list);
    $('#n-pager', el).innerHTML = pager.view(info);
    $('#n-cards', el).innerHTML = list.length ? info.rows.map((r) => dcard({
      lead: iconLead(r.tipo === 'sac' ? 'fa-gift' : 'fa-calendar-days', r.estado === 'pagada' ? 'green' : r.estado === 'borrador' ? '' : 'amber'),
      title: r.label, sub: `${tipoLabel(r.tipo)} · ${r.fechaPago ? 'Pago ' + dateAR(r.fechaPago) : 'Sin fecha de pago'}`, badge: estadoBadge(r),
      rows: [['fa-users', 'Empleados', r.totals.empleados], ['fa-file-invoice-dollar', 'Bruto', money(r.totals.bruto)], ['fa-sack-dollar', 'Neto a pagar', money(r.totals.neto), 'hl wide'],
        ['fa-circle-check', 'Pagado', html`${progress(r)}<small class="muted-text">${r.totals.pagados} de ${r.totals.empleados} · ${money(r.totals.pagado)}</small>`, 'wide']],
      actions: html`<a class="btn btn-primary btn-sm" href="#/nomina?id=${r.id}"><i class="fas fa-folder-open"></i> Abrir</a><button class="icon-btn danger" data-del="${r.id}" title="Eliminar"><i class="fas fa-trash"></i></button>`,
    })).join('') : emptyCard('fa-magnifying-glass', 'Sin resultados');
    $('#n-body', el).innerHTML = list.length ? info.rows.map((r) => html`<tr>
      <td><a href="#/nomina?id=${r.id}"><strong>${r.label}</strong></a><br><small class="muted-text">${r.fechaPago ? 'Pago previsto ' + dateAR(r.fechaPago) : 'Sin fecha de pago'}</small></td>
      <td>${tipoLabel(r.tipo)}</td><td class="num">${r.totals.empleados}</td><td class="num">${money(r.totals.bruto)}</td><td class="num"><strong>${money(r.totals.neto)}</strong></td>
      <td>${progress(r)}<small class="muted-text">${r.totals.pagados}/${r.totals.empleados}</small></td><td>${estadoBadge(r)}</td>
      <td class="actions"><div class="row-actions"><a class="icon-btn" href="#/nomina?id=${r.id}" title="Abrir"><i class="fas fa-folder-open"></i></a>
        <button class="icon-btn" data-del="${r.id}" title="Eliminar"><i class="fas fa-trash"></i></button></div></td></tr>`).join('')
      : html`<tr><td colspan="8"><div class="empty"><i class="fas fa-magnifying-glass"></i><h4>Sin resultados</h4></div></td></tr>`;
  }
  mountQuickCalc($('#quick-calc', el), ctx, employees, () => $('[data-action="new"]', el).click());
  if (runs.length) {
    pager.attach($('#n-pager', el)); rows();
    $('#n-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); rows(); }, 150));
    $('#n-estado', el).addEventListener('change', (e) => { f.estado = e.target.value; pager.reset(); rows(); });
  }

  on(el, 'click', '[data-action="new"]', () => newRunDialog(ctx, employees, (run) => ctx.navigate(`nomina?id=${run.id}`)));
  on(el, 'click', '[data-del]', async (_, b) => {
    const run = runs.find((r) => r.id === b.dataset.del);
    if (!(await ctx.confirmDialog({ title: 'Eliminar nómina', message: `Se eliminará "${run.label}" con sus pagos registrados. Esta acción no se puede deshacer.`, confirmText: 'Eliminar', danger: true }))) return;
    try { await ctx.services.payroll.remove(run.id); ctx.toast('Nómina eliminada', 'success'); ctx.navigate('nomina'); } catch { ctx.toast('No se pudo eliminar.', 'error'); }
  });
}

/* ============ DETALLE ============ */
async function mountDetail(el, ctx, id) {
  let run = await ctx.services.payroll.get(id);
  if (!run) { el.innerHTML = html`<div class="card"><div class="card-body empty"><i class="fas fa-circle-question"></i><h4>No encontramos esa nómina</h4><a class="btn btn-primary" href="#/nomina" style="margin-top:1rem">Volver</a></div></div>`; return; }
  const sel = new Set();
  const f = { q: '', pago: '' };
  const pager = createPager({ onChange: () => drawRows() });
  const est = () => ctx.state.settings.estudio;

  const guard = async (fn, okMsg) => {
    try { const next = await fn(); if (next) run = next; if (okMsg) ctx.toast(okMsg, 'success'); draw(); }
    catch (e) { console.error(e); ctx.toast(['LOCKED', 'PAID', 'DRAFT', 'EMPTY'].includes(e.code) ? e.message : 'No se pudo completar la acción.', 'error'); }
  };
  const visible = () => {
    const match = matcher(f.q);
    return run.lines.filter((l) => match(l.nombre, l.legajo, l.dni, l.cuil, l.categoria) &&
      (!f.pago || (f.pago === 'pagado' ? l.pago.estado === 'pagado' : l.pago.estado !== 'pagado')));
  };
  const pendientesVisibles = () => visible().filter((l) => l.pago.estado !== 'pagado');

  /** Datos que completan el recibo (art. 140 LCT). Son avisos: no impiden liquidar ni pagar. */
  const faltantes = () => {
    const e = est(), out = [];
    if (!e.razonSocial || !e.cuit || !e.domicilio) out.push({ txt: `Datos del empleador (${[!e.razonSocial && 'razón social', !e.cuit && 'CUIT', !e.domicilio && 'domicilio'].filter(Boolean).join(', ')})`, href: '#/configuracion', cta: 'Completar en Configuración' });
    const sinCuil = run.lines.filter((l) => !l.cuil).length;
    if (sinCuil) out.push({ txt: `${sinCuil} empleado(s) sin CUIL`, href: '#/empleados', cta: 'Completar en Empleados' });
    if (!run.deposito?.periodo) out.push({ txt: 'Último depósito de aportes (período, fecha y banco)', action: 'meta', cta: 'Completar acá' });
    return out;
  };

  function syncSelUI() {
    const btn = $('[data-action="pay-sel"]', el);
    if (btn) { btn.disabled = !sel.size; btn.innerHTML = `<i class="fas fa-check"></i> Pagar seleccionados (${sel.size})`; }
    $$('[data-sel]', el).forEach((c) => { c.checked = sel.has(c.dataset.sel); c.closest('.dcard')?.classList.toggle('selected', c.checked); });
    const all = $('[data-sel-all]', el), pv = pendientesVisibles();
    if (all) all.checked = pv.length > 0 && pv.every((l) => sel.has(l.employeeId));
  }

  function drawRows() {
    const b = run.estado === 'borrador';
    const list = visible();
    const info = pager.apply(list);
    $('#d-pager', el).innerHTML = pager.view(info);
    $('#d-cards', el).innerHTML = list.length ? info.rows.map((l) => dcard({
      check: !b ? html`<input type="checkbox" class="dcard-check" data-sel="${l.employeeId}" ${sel.has(l.employeeId) ? 'checked' : ''} ${l.pago.estado === 'pagado' ? 'disabled' : ''} aria-label="Seleccionar ${l.nombre}">` : '',
      lead: avatarLead(l.nombre), title: l.nombre,
      sub: [l.legajo && `Leg. ${l.legajo}`, l.cuil ? `CUIL ${l.cuil}` : l.dni ? `DNI ${l.dni}` : 'Sin CUIL/DNI'].filter(Boolean).join(' · '),
      badge: l.pago.estado === 'pagado' ? html`<span class="badge badge-success"><i class="fas fa-circle-check"></i> Pagado</span>` : html`<span class="badge badge-gray"><i class="fas fa-clock"></i> Pendiente</span>`,
      rows: [['fa-file-invoice-dollar', 'Bruto', money(l.totals.bruto)], ['fa-percent', 'Descuentos', money(l.totals.descuentos), 'neg'], ['fa-sack-dollar', 'Neto a cobrar', money(l.totals.neto), 'hl wide'],
        ...(l.pago.estado === 'pagado' ? [['fa-calendar-check', 'Pago', `${dateAR(l.pago.fecha)} · ${medioLabel(l.pago.medio)}`, 'wide']] : [])],
      note: l.warnings?.[0] || '',
      cls: sel.has(l.employeeId) ? 'selected' : '',
      actions: html`<button class="btn btn-outline btn-sm" data-nov="${l.employeeId}"><i class="fas ${b ? 'fa-sliders' : 'fa-eye'}"></i> Novedades</button>
        <button class="btn btn-outline btn-sm" data-slip="${l.employeeId}"><i class="fas fa-file-lines"></i> Recibo</button>
        ${!b ? html`<button class="btn btn-share btn-sm" data-share="${l.employeeId}"><i class="fas fa-share-nodes"></i> Compartir</button>
          ${l.pago.estado === 'pagado' ? html`<button class="icon-btn" data-unpay="${l.employeeId}" title="Revertir pago"><i class="fas fa-rotate-left"></i></button>` : html`<button class="btn btn-primary btn-sm" data-pay="${l.employeeId}"><i class="fas fa-money-bill-transfer"></i> Pagar</button>`}`
          : html`<button class="icon-btn danger" data-rm="${l.employeeId}" title="Quitar de la nómina"><i class="fas fa-user-minus"></i></button>`}`,
    })).join('') : emptyCard('fa-magnifying-glass', 'Sin resultados', 'Probá con otro nombre, legajo o documento.');
    $('#d-body', el).innerHTML = list.length ? info.rows.map((l) => html`<tr>
      ${!b ? html`<td><input type="checkbox" data-sel="${l.employeeId}" ${sel.has(l.employeeId) ? 'checked' : ''} ${l.pago.estado === 'pagado' ? 'disabled' : ''} aria-label="Seleccionar ${l.nombre}"></td>` : ''}
      <td><strong>${l.nombre}</strong><br><small class="muted-text">${[l.legajo && `Leg. ${l.legajo}`, l.cuil ? `CUIL ${l.cuil}` : l.dni ? `DNI ${l.dni}` : 'Sin CUIL/DNI'].filter(Boolean).join(' · ')}${l.novedades?.nota ? ' · ' + l.novedades.nota : ''}</small>
        ${l.warnings?.length ? html`<br><small style="color:var(--warning)"><i class="fas fa-triangle-exclamation"></i> ${l.warnings[0]}</small>` : ''}</td>
      <td class="num">${money(l.totals.bruto)}</td><td class="num">${money(l.totals.descuentos)}</td><td class="num"><strong>${money(l.totals.neto)}</strong></td>
      <td>${l.pago.estado === 'pagado' ? html`<span class="badge badge-success">Pagado</span><br><small class="muted-text">${dateAR(l.pago.fecha)} · ${medioLabel(l.pago.medio)}</small>` : html`<span class="badge badge-gray">Pendiente</span>`}</td>
      <td class="actions"><div class="row-actions">
        <button class="icon-btn" data-nov="${l.employeeId}" title="${b ? 'Novedades' : 'Ver novedades'}"><i class="fas ${b ? 'fa-sliders' : 'fa-eye'}"></i></button>
        <button class="icon-btn" data-slip="${l.employeeId}" title="Recibo de haberes"><i class="fas fa-file-lines"></i></button>
        ${!b ? shareBtn('data-share', l.employeeId) : ''}
        ${!b ? (l.pago.estado === 'pagado' ? html`<button class="icon-btn" data-unpay="${l.employeeId}" title="Revertir pago"><i class="fas fa-rotate-left"></i></button>` : html`<button class="icon-btn" data-pay="${l.employeeId}" title="Registrar pago"><i class="fas fa-money-bill-transfer"></i></button>`) : html`<button class="icon-btn" data-rm="${l.employeeId}" title="Quitar de la nómina"><i class="fas fa-user-minus"></i></button>`}
      </div></td></tr>`).join('')
      : html`<tr><td colspan="${b ? 6 : 7}"><div class="empty"><i class="fas fa-magnifying-glass"></i><h4>Sin resultados</h4><p>Probá con otro nombre, legajo o documento.</p></div></td></tr>`;
    syncSelUI();
  }

  function draw() {
    const t = run.totals, b = run.estado === 'borrador';
    const pendientes = run.lines.filter((l) => l.pago.estado !== 'pagado');
    el.innerHTML = html`
      <div class="page-head">
        <div><a class="back-home" href="#/nomina"><i class="fas fa-arrow-left"></i> Todas las nóminas</a>
          <h2>${run.label} ${estadoBadge(run)}</h2>
          <p>${tipoLabel(run.tipo)} · ${dateAR(run.desde)} al ${dateAR(run.hasta)} · ${run.fechaPago ? 'Pago previsto ' + dateAR(run.fechaPago) : 'sin fecha de pago'}</p></div>
        <div class="page-actions">
          ${b ? html`<button class="btn btn-outline" data-action="refresh"><i class="fas fa-rotate"></i> Actualizar fichas</button>
                     <button class="btn btn-primary" data-action="close"><i class="fas fa-lock"></i> Liquidar nómina</button>`
              : html`${run.estado !== 'pagada' ? html`<button class="btn btn-primary" data-action="pay-all" ${pendientes.length ? '' : 'disabled'}><i class="fas fa-money-bill-transfer"></i> Pagar pendientes (${pendientes.length})</button>` : ''}
                     <button class="btn btn-outline" data-action="reopen"><i class="fas fa-lock-open"></i> Reabrir</button>`}
          ${!b ? html`<button class="btn btn-share" data-action="share-all"><i class="fas fa-share-nodes"></i> Compartir recibos</button>` : ''}
          <button class="btn btn-outline" data-action="meta"><i class="fas fa-file-signature"></i> Datos del recibo</button>
          <details class="menu"><summary class="btn btn-outline"><i class="fas fa-download"></i> Exportar <i class="fas fa-angle-down"></i></summary>
            <div class="menu-list">
              <button data-action="print-all"><i class="fas fa-print"></i> Imprimir todos los recibos</button>
              <button data-action="pdf-all"><i class="fas fa-file-pdf"></i> Recibos de haberes (PDF)</button>
              <button data-action="pdf-sum"><i class="fas fa-file-pdf"></i> Resumen de la nómina (PDF)</button><hr>
              <button data-action="xlsx"><i class="fas fa-file-excel"></i> Excel completo</button>
              <button data-action="csv"><i class="fas fa-file-csv"></i> Planilla de pagos (CSV)</button>
            </div></details>
        </div>
      </div>

      ${faltantes().length ? html`<div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-circle-info"></i><div><strong>Para que los recibos queden completos (art. 140 LCT) faltan estos datos.</strong> Es solo un aviso: podés liquidar y pagar igual.
        <ul style="margin:.4rem 0 0 1rem;list-style:disc">${faltantes().map((f) => html`<li>${f.txt} — ${f.href ? html`<a href="${f.href}">${f.cta}</a>` : html`<button type="button" class="link-btn" data-action="${f.action}">${f.cta}</button>`}</li>`)}</ul></div></div>` : ''}
      ${run.lines.some((l) => l.totals.neto < 0) ? html`<div class="alert alert-error" style="margin-bottom:1rem"><i class="fas fa-circle-exclamation"></i><div>Hay empleados con neto negativo. Revisá adelantos y descuentos.</div></div>` : ''}
      ${b ? html`<div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-circle-info"></i><div>La nómina está en <strong>borrador</strong>: cargá a mano las horas extra, faltas, bonos, adelantos y descuentos de cada empleado y luego <strong>liquidala</strong> para habilitar los pagos.</div></div>` : ''}


      <div class="grid grid-4 mb">
        <div class="card stat"><div class="ico blue"><i class="fas fa-file-invoice-dollar"></i></div><div><small>Bruto</small>${statValue(money(t.bruto))}</div></div>
        <div class="card stat"><div class="ico amber"><i class="fas fa-percent"></i></div><div><small>Aportes y descuentos</small>${statValue(money(t.descuentos))}</div></div>
        <div class="card stat"><div class="ico green"><i class="fas fa-sack-dollar"></i></div><div><small>Neto a pagar</small>${statValue(money(t.neto))}</div></div>
        <div class="card stat"><div class="ico violet"><i class="fas fa-building"></i></div><div><small>Costo empresa (c/ patronales)</small>${statValue(money(t.costo))}</div></div>
      </div>

      <div class="card">
        <div class="card-header">
          <div style="flex:1;min-width:220px"><h3>Empleados (${t.empleados})</h3>
            <div style="display:flex;gap:.8rem;align-items:center;margin-top:.3rem"><div style="flex:1;max-width:260px">${progress(run)}</div><small class="muted-text">Pagado ${money(t.pagado)} · Pendiente ${money(t.pendiente)}</small></div></div>
          ${!b ? html`<button class="btn btn-primary btn-sm" data-action="pay-sel" disabled><i class="fas fa-check"></i> Pagar seleccionados (0)</button>` : ''}
        </div>
        <div class="card-body" style="padding-bottom:0">
          <div class="toolbar">
            <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="d-q" type="search" placeholder="Buscar por nombre, legajo o documento…" value="${f.q}"></div>
            <select class="select" id="d-pago"><option value="">Todos</option><option value="pendiente" ${f.pago === 'pendiente' ? 'selected' : ''}>Pendientes de pago</option><option value="pagado" ${f.pago === 'pagado' ? 'selected' : ''}>Pagados</option></select>
          </div>
        </div>
        <div class="card-body" style="padding:0"><div class="table-wrap has-cards"><table class="table">
          <thead><tr>${!b ? html`<th style="width:36px"><input type="checkbox" data-sel-all aria-label="Seleccionar pendientes"></th>` : ''}
            <th>Empleado</th><th class="num">Bruto</th><th class="num">Descuentos</th><th class="num">Neto</th><th>Pago</th><th></th></tr></thead>
          <tbody id="d-body"></tbody>
          <tfoot><tr>${!b ? html`<td></td>` : ''}<td>Total nómina</td><td class="num">${money(t.bruto)}</td><td class="num">${money(t.descuentos)}</td><td class="num">${money(t.neto)}</td><td colspan="2"></td></tr></tfoot>
        </table></div><div class="cards-list detail-cards" id="d-cards"></div><div id="d-pager" class="table-card-pager"></div></div>
        <div class="card-footer"><small class="muted-text">Contribuciones patronales estimadas: ${money(t.patronal)} (según porcentajes de Configuración). Las estimaciones no reemplazan la liquidación contable ni las declaraciones juradas.</small></div>
      </div>`;
    pager.attach($('#d-pager', el));
    drawRows();
    $('#d-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); drawRows(); }, 150));
    $('#d-pago', el).addEventListener('change', (e) => { f.pago = e.target.value; pager.reset(); drawRows(); });
  }
  draw();

  const line = (i) => run.lines.find((l) => l.employeeId === i);
  on(el, 'change', '[data-sel-all]', (_, c) => { pendientesVisibles().forEach((l) => (c.checked ? sel.add(l.employeeId) : sel.delete(l.employeeId))); drawRows(); });
  on(el, 'change', '[data-sel]', (_, c) => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); syncSelUI(); });
  on(el, 'click', '[data-nov]', (_, b) => novedadesDialog(ctx, run, line(b.dataset.nov), (next) => { run = next; draw(); }));
  on(el, 'click', '[data-share]', (_, b) => sharePayslip(ctx, run, line(b.dataset.share)));
  on(el, 'click', '[data-slip]', (_, b) => payslipDialog(ctx, run, line(b.dataset.slip)));
  on(el, 'click', '[data-pay]', (_, b) => pagoDialog(ctx, run, [b.dataset.pay], (n) => { run = n; draw(); }));
  on(el, 'click', '[data-unpay]', (_, b) => guard(() => ctx.services.payroll.revertirPago(run, [b.dataset.unpay]), 'Pago revertido'));
  on(el, 'click', '[data-rm]', async (_, b) => {
    if (await ctx.confirmDialog({ title: 'Quitar empleado', message: `¿Quitar a ${line(b.dataset.rm).nombre} de esta nómina?`, confirmText: 'Quitar', danger: true })) guard(() => ctx.services.payroll.removeLine(run, b.dataset.rm), 'Empleado quitado');
  });

  const withBusy = async (b, fn, errMsg) => {
    b.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (e) { console.error(e); ctx.toast(errMsg, 'error'); } finally { b.removeAttribute('aria-busy'); }
  };
  on(el, 'click', '[data-action]', async (_, b) => {
    const a = b.dataset.action;
    b.closest('details')?.removeAttribute('open');
    if (a === 'refresh') guard(async () => { run = await ctx.services.payroll.refresh(run, await ctx.services.employees.list(), ctx.state.settings); return run; }, 'Fichas actualizadas');
    if (a === 'close' && await ctx.confirmDialog({ title: 'Liquidar nómina', message: 'Se fijan los importes con los parámetros actuales y se habilitan los pagos. Podrás reabrirla mientras no haya pagos registrados.', confirmText: 'Liquidar' }))
      guard(() => ctx.services.payroll.cerrar(run, ctx.state.settings), 'Nómina liquidada');
    if (a === 'meta') metaDialog(ctx, run, (n) => { run = n; draw(); });
    if (a === 'reopen') guard(() => ctx.services.payroll.reabrir(run), 'Nómina reabierta');
    if (a === 'pay-all') pagoDialog(ctx, run, run.lines.filter((l) => l.pago.estado !== 'pagado').map((l) => l.employeeId), (n) => { run = n; sel.clear(); draw(); });
    if (a === 'pay-sel') pagoDialog(ctx, run, [...sel], (n) => { run = n; sel.clear(); draw(); });
    if (a === 'share-all') shareBatch(ctx, run);
    if (a === 'print-all') printAllPayslips(ctx, run);
    if (a === 'csv') exportPagosCSV(run);
    if (a === 'xlsx') withBusy(b, () => exportNominaXLSX(run), 'No se pudo generar el Excel. Revisá tu conexión.');
    if (a === 'pdf-all') { ctx.toast('Generando PDF…', 'info', 1500); withBusy(b, () => downloadPayslipsPDF(run, run.lines, est(), ctx.user.name), 'No se pudo generar el PDF. Revisá tu conexión.'); }
    if (a === 'pdf-sum') withBusy(b, () => downloadPayrollSummaryPDF(run, est(), ctx.user.name), 'No se pudo generar el PDF. Revisá tu conexión.');
  });
}

export default {
  id: 'nomina', title: 'Liquidaciones', short: 'Nómina', icon: 'fa-money-check-dollar', group: 'Principal',
  mount(el, ctx, params) { return params.get('id') ? mountDetail(el, ctx, params.get('id')) : mountList(el, ctx); },
};
