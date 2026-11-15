import { $ } from '../../core/dom.js';
import { html } from '../../core/html.js';
import { money } from '../../core/format.js';
import { PLANS, PLAN_COMPARISON } from '../../config/plans.config.js';
import { APP, ROUTES } from '../../config/app.config.js';

$('#year').textContent = new Date().getFullYear();

const cta = (p) => {
  if (p.id === 'free') return html`<a class="btn btn-outline btn-block" href="${ROUTES.login}?modo=registro">Usar simulador</a>`;
  const msg = encodeURIComponent(`Hola, me interesa el plan ${p.name} de ArgenLiquid PRO.`);
  return html`<a class="btn ${p.highlight ? 'btn-primary' : 'btn-secondary'} btn-block" href="https://wa.me/${APP.whatsapp}?text=${msg}" target="_blank" rel="noopener">${p.highlight ? 'Comenzar ahora PRO' : 'Contactar ventas'}</a>`;
};

$('#plans').innerHTML = Object.values(PLANS).map((p) => html`
  <article class="plan ${p.highlight ? 'highlight' : ''}">
    ${p.highlight ? html`<span class="ribbon">MÁS ELEGIDO</span>` : ''}
    <h3>${p.name}</h3><p class="tagline">${p.tagline}</p>
    <div class="price">${p.price ? money(p.price).replace(/,00$/, '') : '$0'} <small>/${p.period}</small></div>
    <ul>${p.features.map((f) => html`<li><i class="fas fa-check"></i>${f}</li>`)}</ul>
    ${cta(p)}
  </article>`).join('');

const mark = (v) => (v ? html`<i class="fas fa-check yes"></i>` : html`<i class="fas fa-minus no"></i>`);
$('#compare').innerHTML = html`
  <thead><tr><th>Funcionalidad</th><th>Libre</th><th>PRO</th><th>Estudio</th></tr></thead>
  <tbody>${PLAN_COMPARISON.map(([t, a, b, c]) => html`<tr><td>${t}</td><td>${mark(a)}</td><td>${mark(b)}</td><td>${mark(c)}</td></tr>`)}</tbody>`;
