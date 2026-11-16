import { html } from '../../core/html.js';
import { MARKETING } from '../../config/marketing.config.js';
import { APP, ROUTES } from '../../config/app.config.js';
import { raw } from '../../core/html.js';

/** Panel publicitario del login (lado izquierdo). Contenido editable en marketing.config.js */
export function promoView() {
  const m = MARKETING;
  return html`
    <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>

    <a class="brand" href="${ROUTES.home}">
      <span class="brand-mark"><img src="${new URL('../../../assets/logo.svg', import.meta.url).href}" alt="" width="40" height="40"></span>
      <span>${APP.name} <small>${APP.edition}</small></span>
    </a>

    <div class="promo-body">
      <h1>${raw(m.headline)}</h1>
      <p>${m.subheadline}</p>

      <div class="promo-features">
        ${m.features.map((f) => html`
          <div class="promo-feature">
            <i class="fas ${f.icon}"></i>
            <div><strong>${f.title}</strong><span>${f.text}</span></div>
          </div>`)}
      </div>

      <div class="promo-demo">
        <div class="ico"><i class="fas fa-calculator"></i></div>
        <div>
          <small>${m.demoCard.label}</small>
          <strong>${m.demoCard.amount}</strong><span class="tag">${m.demoCard.ref}</span>
        </div>
      </div>
    </div>

    <div>
      <div class="promo-stats">
        ${m.stats.map((s) => html`<div><strong>${s.value}</strong><span>${s.label}</span></div>`)}
      </div>
      <div class="promo-foot" style="margin-top:1.4rem">
        <span>© ${new Date().getFullYear()} ${APP.name} ${APP.edition}</span>
        <a href="${ROUTES.plans}">Ver planes y precios <i class="fas fa-arrow-right"></i></a>
      </div>
    </div>`;
}
