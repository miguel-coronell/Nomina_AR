import { html } from '../../../../core/html.js';
import { $, on, debounce } from '../../../../core/dom.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { money, dateAR, dateTimeAR } from '../../../../core/format.js';
import { toCSV, downloadFile } from '../../../../core/csv.js';
import { MOTIVOS, motivoLabel } from '../../../../domain/legal/params.js';
import { dcard, iconLead, emptyCard } from '../../../../core/ui/cards.js';
import { shareLiquidacion, shareBtn } from '../../shared/share.dialog.js';

export default {
  id: 'historial', title: 'Historial', icon: 'fa-clock-rotate-left', group: 'Principal',

  async mount(el, ctx) {
    let items = await ctx.services.liquidations.list();
    const f = { q: '', motivo: '' };

    const pager = createPager({ onChange: () => rows() });
    const filtered = () => {
      const match = matcher(f.q);
      return items.filter((l) => (!f.motivo || l.input.motivo === f.motivo) && match(l.employeeName, l.employeeDni, l.employeeLegajo));
    };

    const rows = () => {
      const list = filtered();
      const info = pager.apply(list);
      $('#h-pager', el).innerHTML = pager.view(info);
      $('#h-cards', el).innerHTML = list.length ? info.rows.map((l) => dcard({
        lead: iconLead('fa-file-signature'), title: l.employeeName,
        sub: [l.employeeDni && `DNI ${l.employeeDni}`, l.employeeLegajo && `Leg. ${l.employeeLegajo}`].filter(Boolean).join(' · '),
        badge: html`<span class="badge">${motivoLabel(l.input.motivo)}</span>`,
        rows: [['fa-calendar-plus', 'Guardada', dateAR(l.createdAt)], ['fa-door-open', 'Egreso', dateAR(l.input.fechaEgreso)], ['fa-sack-dollar', 'Neto a cobrar', money(l.totals.neto), 'hl wide']],
        actions: html`<a class="btn btn-outline btn-sm" href="#/recibos?id=${l.id}"><i class="fas fa-file-lines"></i> Recibo</a>${shareBtn('data-share', l.id, { label: true })}<button class="icon-btn danger" data-del="${l.id}" title="Eliminar"><i class="fas fa-trash"></i></button>`,
      })).join('') : emptyCard('fa-folder-open', 'Sin resultados');
      $('#h-body', el).innerHTML = list.length ? info.rows.map((l) => html`
        <tr>
          <td>${dateTimeAR(l.createdAt)}</td>
          <td><strong>${l.employeeName}</strong><br><small class="muted-text">${[l.employeeDni && `DNI ${l.employeeDni}`, l.employeeLegajo && `Leg. ${l.employeeLegajo}`].filter(Boolean).join(' · ')}</small></td>
          <td>${motivoLabel(l.input.motivo)}</td>
          <td>${dateAR(l.input.fechaEgreso)}</td>
          <td class="num"><strong>${money(l.totals.neto)}</strong></td>
          <td class="actions"><div class="row-actions">
            <a class="icon-btn" href="#/recibos?id=${l.id}" title="Ver recibo"><i class="fas fa-file-lines"></i></a>
            ${shareBtn('data-share', l.id)}
            <button class="icon-btn" data-del="${l.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('') : html`<tr><td colspan="6"><div class="empty"><i class="fas fa-folder-open"></i><h4>Sin resultados</h4></div></td></tr>`;
      $('#h-total', el).textContent = `${list.length} liquidación(es) · ${money(list.reduce((a, l) => a + l.totals.neto, 0))} neto`;
    };

    el.innerHTML = html`
      <div class="page-head">
        <div><h2>Historial de liquidaciones</h2><p>Todas las liquidaciones guardadas en tu cuenta.</p></div>
        <div class="page-actions"><button class="btn btn-outline" data-action="csv"><i class="fas fa-file-csv"></i> Exportar CSV</button></div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="toolbar">
            <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="h-q" type="search" placeholder="Buscar por nombre, legajo o documento…"></div>
            <select class="select" id="h-motivo"><option value="">Todos los motivos</option>${MOTIVOS.map((m) => html`<option value="${m.id}">${m.label}</option>`)}</select>
            <span class="muted-text toolbar-total" id="h-total"></span>
          </div>
          <div class="table-wrap has-cards"><table class="table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Motivo</th><th>Egreso</th><th class="num">Neto</th><th></th></tr></thead>
            <tbody id="h-body"></tbody>
          </table></div>
          <div class="cards-list" id="h-cards"></div>
          <div id="h-pager"></div>
        </div>
      </div>`;
    pager.attach($('#h-pager', el));
    rows();

    $('#h-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); rows(); }, 150));
    $('#h-motivo', el).addEventListener('change', (e) => { f.motivo = e.target.value; pager.reset(); rows(); });

    on(el, 'click', '[data-share]', (_, b) => shareLiquidacion(ctx, items.find((l) => l.id === b.dataset.share)));

    on(el, 'click', '[data-del]', async (_, btn) => {
      if (!(await ctx.confirmDialog({ title: 'Eliminar liquidación', message: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', danger: true }))) return;
      try {
        await ctx.services.liquidations.remove(btn.dataset.del);
        items = items.filter((l) => l.id !== btn.dataset.del);
        rows(); ctx.toast('Liquidación eliminada', 'success');
      } catch { ctx.toast('No se pudo eliminar', 'error'); }
    });

    on(el, 'click', '[data-action="csv"]', () => {
      const list = filtered();
      if (!list.length) return ctx.toast('No hay datos para exportar', 'info');
      const csv = toCSV(list, [
        { label: 'Fecha', value: (l) => dateTimeAR(l.createdAt) },
        { label: 'Empleado', key: 'employeeName' },
        { label: 'DNI', key: 'employeeDni' },
        { label: 'Motivo', value: (l) => motivoLabel(l.input.motivo) },
        { label: 'Ingreso', value: (l) => dateAR(l.input.fechaIngreso) },
        { label: 'Egreso', value: (l) => dateAR(l.input.fechaEgreso) },
        { label: 'Remuneración', value: (l) => l.input.sueldo },
        { label: 'Bruto', value: (l) => l.totals.bruto },
        { label: 'Descuentos', value: (l) => l.totals.deducciones },
        { label: 'Neto', value: (l) => l.totals.neto },
      ]);
      downloadFile(`historial_liquidaciones_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    });
  },
};
