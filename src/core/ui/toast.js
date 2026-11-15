const ICONS = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };

function container() {
  let c = document.getElementById('toasts');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toasts';
    c.className = 'toasts';
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  return c;
}

export function toast(message, type = 'info', ms = 4000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icon = document.createElement('i');
  icon.className = `fas ${ICONS[type] || ICONS.info}`;
  const span = document.createElement('span');
  span.textContent = message;
  el.append(icon, span);
  container().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
