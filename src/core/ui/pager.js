import { html, raw } from '../html.js';

/**
 * Paginador reutilizable (10 por página por defecto).
 *   const pager = createPager({ onChange: draw });
 *   pager.attach(hostEl);                    // una sola vez
 *   const info = pager.apply(listaFiltrada); // { rows, total, page, pages, from, to }
 *   hostEl.innerHTML = pager.view(info);
 * Al cambiar un filtro o la búsqueda, llamar pager.reset() antes de redibujar.
 */
export function createPager({ size = 10, sizes = [10, 25, 50], onChange = () => {} } = {}) {
  let page = 1;

  const numbers = (cur, pages) => {
    const set = new Set([1, pages, cur - 1, cur, cur + 1]);
    const list = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
    const out = [];
    list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push('…'); out.push(n); });
    return out;
  };

  return {
    get size() { return size; },
    get page() { return page; },
    reset() { page = 1; },

    apply(items) {
      const pages = Math.max(1, Math.ceil(items.length / size));
      page = Math.min(Math.max(1, page), pages);
      const start = (page - 1) * size;
      return { rows: items.slice(start, start + size), total: items.length, page, pages, size, from: items.length ? start + 1 : 0, to: Math.min(items.length, start + size) };
    },

    view(info) {
      if (!info.total) return '';
      const btn = (label, p, { disabled = false, active = false, aria = '' } = {}) =>
        html`<button type="button" class="pg-btn ${active ? 'active' : ''}" data-page="${p}" ${raw(disabled ? 'disabled' : '')} ${raw(aria ? `aria-label="${aria}"` : '')} ${raw(active ? 'aria-current="page"' : '')}>${raw(label)}</button>`;
      return html`
        <div class="pager">
          <span class="pager-info">Mostrando <b>${info.from}–${info.to}</b> de <b>${info.total}</b></span>
          ${info.pages > 1 ? html`<nav class="pager-nav" aria-label="Paginación">
            ${btn('<i class="fas fa-angle-left"></i>', info.page - 1, { disabled: info.page === 1, aria: 'Página anterior' })}
            ${numbers(info.page, info.pages).map((n) => (n === '…' ? html`<span class="pg-gap">…</span>` : btn(n, n, { active: n === info.page })))}
            ${btn('<i class="fas fa-angle-right"></i>', info.page + 1, { disabled: info.page === info.pages, aria: 'Página siguiente' })}
          </nav>` : ''}
          <label class="pager-size">Por página
            <select class="select" data-page-size>${sizes.map((s) => html`<option value="${s}" ${raw(s === size ? 'selected' : '')}>${s}</option>`)}</select></label>
        </div>`;
    },

    attach(host) {
      host.addEventListener('click', (e) => {
        const b = e.target.closest('[data-page]');
        if (!b || b.disabled) return;
        page = Number(b.dataset.page);
        onChange();
      });
      host.addEventListener('change', (e) => {
        if (!e.target.matches('[data-page-size]')) return;
        size = Number(e.target.value); page = 1; onChange();
      });
    },
  };
}
