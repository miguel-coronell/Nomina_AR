import { html } from '../../../../core/html.js';
import { $, on, debounce } from '../../../../core/dom.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { money, dateAR } from '../../../../core/format.js';
import { motivoLabel } from '../../../../domain/legal/params.js';
import { receiptHTML } from './receipt.view.js';
import { exportReceiptPDF, printReceipt } from './receipt.actions.js';
import { shareLiquidacion } from '../../shared/share.dialog.js';

export default {
  id: 'recibos', title: 'Recibos', icon: 'fa-file-lines', group: 'Principal',

  async mount(el, ctx, params) {
    let items = await ctx.services.liquidations.list();
    let selected = items.find((l) => l.id === params.get('id')) || items[0] || null;
    let q = '';
    const pager = createPager({ size: 10, sizes: [10, 25], onChange: () => drawList() });

    el.innerHTML = html`
      <div class="page-head"><div><h2>Recibos</h2><p>Vista previa, impresión y descarga en PDF de tus liquidaciones.</p></div></div>
      <div class="receipts-layout">
        <div class="card">
          <div class="card-body" style="padding:1rem"><div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="r-q" type="search" placeholder="Nombre, legajo o documento…"></div></div>
          <ul class="pick-list" id="r-list"></ul>
          <div id="r-pager" class="table-card-pager"></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Vista previa</h3>
            <div class="page-actions" id="r-actions">
              <button class="btn btn-outline btn-sm" data-action="print"><i class="fas fa-print"></i> Imprimir</button>
              <button class="btn btn-share btn-sm" data-action="share"><i class="fas fa-share-nodes"></i> Compartir</button>
              <button class="btn btn-primary btn-sm" data-action="pdf"><i class="fas fa-file-pdf"></i> Descargar PDF</button>
              <button class="btn btn-outline btn-sm btn-danger-outline" data-action="delete" title="Eliminar este recibo"><i class="fas fa-trash"></i> Eliminar</button>
            </div></div>
          <div class="card-body receipt-scroll" id="r-preview"></div>
        </div>
      </div>`;

    const list = $('#r-list', el), preview = $('#r-preview', el), acts = $('#r-actions', el);

    const drawList = () => {
      const match = matcher(q);
      const found = items.filter((l) => match(l.employeeName, l.employeeDni, l.employeeLegajo));
      const info = pager.apply(found);
      $('#r-pager', el).innerHTML = pager.view(info);
      list.innerHTML = found.length ? info.rows.map((l) => html`
        <li data-id="${l.id}" class="${selected?.id === l.id ? 'active' : ''}">
          <div><strong>${l.employeeName}</strong><small>${motivoLabel(l.input.motivo)} · ${dateAR(l.input.fechaEgreso)}</small></div>
          <b>${money(l.totals.neto)}</b></li>`).join('')
        : html`<li style="cursor:default"><div class="empty" style="width:100%"><i class="fas fa-folder-open"></i><h4>Sin liquidaciones</h4><p>Guardalas desde el simulador.</p></div></li>`;
    };
    const drawPreview = () => {
      acts.hidden = !selected;
      preview.innerHTML = selected ? receiptHTML(selected, ctx.state.settings.estudio, ctx.user.name, { patronales: ctx.state.settings.patronales })
        : html`<div class="empty"><i class="fas fa-file-lines"></i><h4>Nada para mostrar</h4><a class="btn btn-primary" style="margin-top:1rem" href="#/simulador">Ir al simulador</a></div>`;
    };
    pager.attach($('#r-pager', el));
    drawList(); drawPreview();

    $('#r-q', el).addEventListener('input', debounce((e) => { q = e.target.value; pager.reset(); drawList(); }, 150));
    on(el, 'click', '#r-list [data-id]', (_, li) => {
      selected = items.find((l) => l.id === li.dataset.id); drawList(); drawPreview();
      if (matchMedia('(max-width: 1050px)').matches) $('#r-preview', el).closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    on(el, 'click', '[data-action="share"]', () => selected && shareLiquidacion(ctx, selected));
    on(el, 'click', '[data-action="print"]', () => selected && printReceipt(selected, ctx));
    on(el, 'click', '[data-action="delete"]', async (_, b) => {
      if (!selected) return;
      const rec = selected;
      if (!(await ctx.confirmDialog({ title: 'Eliminar recibo', message: `Se eliminará la liquidación de ${rec.employeeName} (${dateAR(rec.input.fechaEgreso)}). Esta acción no se puede deshacer.`, confirmText: 'Eliminar', danger: true }))) return;
      b.setAttribute('aria-busy', 'true');
      try {
        await ctx.services.liquidations.remove(rec.id);
        const i = items.findIndex((l) => l.id === rec.id);
        items = items.filter((l) => l.id !== rec.id);
        selected = items[Math.min(i, items.length - 1)] || null;
        drawList(); drawPreview();
        ctx.toast('Recibo eliminado', 'success');
      } catch (e) { console.error(e); ctx.toast('No se pudo eliminar el recibo.', 'error'); }
      finally { b.removeAttribute('aria-busy'); }
    });
    on(el, 'click', '[data-action="pdf"]', async (_, b) => {
      b.setAttribute('aria-busy', 'true');
      try { await exportReceiptPDF(selected, ctx); } catch { ctx.toast('No se pudo generar el PDF. Revisá tu conexión.', 'error'); }
      finally { b.removeAttribute('aria-busy'); }
    });
  },
};
