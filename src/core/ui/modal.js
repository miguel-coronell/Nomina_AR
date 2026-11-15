import { esc } from '../html.js';

/**
 * Abre un modal. `body` puede ser string HTML ya seguro o un Node.
 * Devuelve { el, close }.
 */
export function openModal({ title = '', body = '', footer = '', size = 'md', onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-header">
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar"><i class="fas fa-xmark"></i></button>
      </header>
      <div class="modal-body"></div>
      ${footer ? '<footer class="modal-footer"></footer>' : ''}
    </div>`;
  const bodyEl = overlay.querySelector('.modal-body');
  if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = String(body);
  const footEl = overlay.querySelector('.modal-footer');
  if (footEl) { if (footer instanceof Node) footEl.appendChild(footer); else footEl.innerHTML = String(footer); }

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('open');
    document.body.style.overflow = prevOverflow;
    setTimeout(() => overlay.remove(), 200);
    onClose?.();
  }
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  const first = overlay.querySelector('input,select,textarea,button:not([data-close])');
  setTimeout(() => first?.focus(), 50);

  return { el: overlay, close };
}

/** Diálogo de confirmación. Resuelve true/false. */
export function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let decided = false;
    const done = (v) => { if (!decided) { decided = true; resolve(v); } };
    const footer = document.createElement('div');
    footer.className = 'modal-actions';
    footer.innerHTML = `
      <button type="button" class="btn btn-ghost" data-no>Cancelar</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmText)}</button>`;
    const m = openModal({ title, body: `<p class="muted-text">${esc(message)}</p>`, footer, size: 'sm', onClose: () => done(false) });
    footer.querySelector('[data-no]').onclick = () => { done(false); m.close(); };
    footer.querySelector('[data-yes]').onclick = () => { done(true); m.close(); };
  });
}
