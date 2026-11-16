import { esc } from '../html.js';

/** Icono según el título del diálogo (se puede forzar con la opción `icon`). */
const ICONOS = [
  [/eliminar|borrar/i, 'fa-trash-can', 'danger'], [/confirmar|ya existe/i, 'fa-circle-question', 'warn'],
  [/editar empleado|nuevo empleado|empleado/i, 'fa-user-pen'], [/importar/i, 'fa-file-excel'],
  [/compartir/i, 'fa-share-nodes'], [/recibo|datos del recibo/i, 'fa-file-invoice-dollar'],
  [/pago|cobro/i, 'fa-money-bill-transfer'], [/n[oó]mina/i, 'fa-calculator'],
  [/novedad|licencia|ausencia/i, 'fa-calendar-check'], [/feriado|calendario/i, 'fa-calendar-days'],
  [/liquidaci[oó]n/i, 'fa-scale-balanced'], [/configuraci[oó]n|ajuste|mensaje/i, 'fa-sliders'],
  [/logo|imagen/i, 'fa-image'], [/error|aviso|atenci[oó]n/i, 'fa-triangle-exclamation', 'warn'],
];
const iconoDe = (title) => ICONOS.find(([re]) => re.test(title)) || [null, 'fa-window-restore'];

/** Iconos para los títulos de sección de los formularios (.fieldset-title / .sec-title) sin icono propio. */
const ICONOS_SECCION = [
  [/personal|identific/i, 'fa-id-card'], [/relaci[oó]n|laboral|empresa/i, 'fa-briefcase'], [/pasant/i, 'fa-graduation-cap'],
  [/jornada|horario/i, 'fa-clock'], [/remuner|n[oó]mina|sueldo|haber/i, 'fa-sack-dollar'], [/cobertura|cobro|banc|pago/i, 'fa-building-columns'],
  [/contacto|domicilio/i, 'fa-address-book'], [/nota|observ/i, 'fa-note-sticky'], [/descuento|deducc/i, 'fa-minus-circle'],
  [/hora|extra/i, 'fa-stopwatch'], [/bono|adicional|concepto/i, 'fa-plus-circle'], [/mensaje|whatsapp|correo/i, 'fa-paper-plane'],
];
function decorar(root) {
  root.querySelectorAll('.fieldset-title:not([data-i]), .section-title:not([data-i])').forEach((el) => {
    el.dataset.i = '1';
    if (el.querySelector('i')) return;
    const ic = (ICONOS_SECCION.find(([re]) => re.test(el.textContent)) || [null, 'fa-circle-dot'])[1];
    el.insertAdjacentHTML('afterbegin', `<i class="fas ${ic}" aria-hidden="true"></i> `);
  });
}

/**
 * Abre un modal. `body` puede ser string HTML ya seguro o un Node.
 * Devuelve { el, close }.
 */
export function openModal({ title = '', body = '', footer = '', size = 'md', icon, onClose } = {}) {
  const [, ico, tone] = icon ? [0, icon] : iconoDe(title);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-header">
        <span class="modal-ico ${tone ? `is-${tone}` : ''}" aria-hidden="true"><i class="fas ${esc(ico)}"></i></span>
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar" title="Cerrar (Esc)"><i class="fas fa-xmark"></i></button>
      </header>
      <div class="modal-body"></div>
      ${footer ? '<footer class="modal-footer"></footer>' : ''}
    </div>`;
  const bodyEl = overlay.querySelector('.modal-body');
  if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = String(body);
  const footEl = overlay.querySelector('.modal-footer');
  if (footEl) { if (footer instanceof Node) footEl.appendChild(footer); else footEl.innerHTML = String(footer); }

  decorar(overlay);
  new MutationObserver(() => decorar(overlay)).observe(bodyEl, { childList: true, subtree: true });

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
      <button type="button" class="btn btn-ghost" data-no><i class="fas fa-xmark"></i> Cancelar</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes><i class="fas ${danger ? 'fa-trash-can' : 'fa-check'}"></i> ${esc(confirmText)}</button>`;
    const m = openModal({ title, body: `<p class="muted-text">${esc(message)}</p>`, footer, size: 'sm', icon: danger ? 'fa-triangle-exclamation' : 'fa-circle-question', onClose: () => done(false) });
    footer.querySelector('[data-no]').onclick = () => { done(false); m.close(); };
    footer.querySelector('[data-yes]').onclick = () => { done(true); m.close(); };
  });
}
