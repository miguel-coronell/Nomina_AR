import { html, raw } from '../html.js';
import { initials } from '../format.js';

/**
 * Tarjeta de registro para móvil (reemplaza una fila de tabla).
 *   dcard({ lead, title, sub, badge, rows: [[icono, etiqueta, valor, clase?]], note, actions, attrs, cls, check })
 * `lead` e `check` ya deben ser HTML seguro (usá avatarLead / iconLead). `attrs` son atributos crudos.
 */
export const dcard = ({ lead = '', title, sub = '', badge = '', rows = [], note = '', actions = '', attrs = '', cls = '', check = '' }) => html`
  <article class="dcard ${cls}" ${raw(attrs)}>
    <header class="dcard-top">${check}${lead}
      <div class="dcard-id"><strong>${title}</strong>${sub ? html`<small>${sub}</small>` : ''}</div>${badge}</header>
    ${rows.length ? html`<dl class="dcard-meta">${rows.map(([icon, label, value, c = '']) => html`
      <div class="${c}"><dt><i class="fas ${icon}"></i> ${label}</dt><dd>${value}</dd></div>`)}</dl>` : ''}
    ${note ? html`<div class="dcard-note"><i class="fas fa-triangle-exclamation"></i><span>${note}</span></div>` : ''}
    ${actions ? html`<footer class="dcard-actions">${actions}</footer>` : ''}
  </article>`;

export const avatarLead = (name) => html`<span class="avatar">${initials(name)}</span>`;
export const iconLead = (icon, tone = '') => html`<span class="dcard-ico ${tone}"><i class="fas ${icon}"></i></span>`;
export const emptyCard = (icon, title, text = '') => html`<div class="empty"><i class="fas ${icon}"></i><h4>${title}</h4>${text ? html`<p>${text}</p>` : ''}</div>`;
