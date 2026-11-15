/**
 * Plantillas HTML seguras. Todo valor interpolado se escapa salvo que sea `raw()`.
 *   el.innerHTML = html`<li>${nombre}</li>`;
 */
class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
export const raw = (s) => new Raw(String(s ?? ''));

const render = (v) => {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
};

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}
