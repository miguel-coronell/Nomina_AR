import { html } from '../../../core/html.js';
import { initials } from '../../../core/format.js';
import { APP, ROUTES } from '../../../config/app.config.js';

const GROUPS = ['Principal', 'Recursos', 'Cuenta'];
/** Accesos de la barra inferior (móvil): ids de módulo + el botón "Menú" que abre el panel lateral. */
const TABS = ['dashboard', 'empleados', 'nomina', 'pagos'];

export function shellView({ modules, user, plan }) {
  return html`
  <div class="app-shell" id="shell">
    <aside class="sidebar" aria-label="Menú principal">
      <a class="brand" href="${ROUTES.home}">
        <span class="brand-mark"><i class="fas fa-cube"></i></span>
        <span>${APP.name} <small>${APP.edition}</small></span>
      </a>
      ${GROUPS.map((g) => {
        const items = modules.filter((m) => (m.group || 'Principal') === g);
        return items.length ? html`
          <nav class="nav-group">
            
            ${items.map((m) => html`<a class="nav-link" href="#/${m.id}" data-nav="${m.id}"><i class="fas ${m.icon}"></i><span>${m.title}</span></a>`)}
          </nav>` : '';
      })}
      <div class="sidebar-foot">
        <div class="user-chip">
          <div class="avatar">${user.photoURL ? html`<img src="${user.photoURL}" alt="" referrerpolicy="no-referrer">` : initials(user.name)}</div>
          <div class="who"><strong>${user.name}</strong><small>${user.email}</small></div>
        </div>
        <button class="btn btn-block btn-sm" data-action="logout"><i class="fas fa-right-from-bracket"></i> Cerrar sesión</button>
      </div>
    </aside>
    <div class="scrim" data-action="close-nav"></div>

    <div class="app-main">
      <header class="topbar">
        <div class="left">
          <button class="icon-btn menu-btn" data-action="open-nav" aria-label="Abrir menú"><i class="fas fa-bars"></i></button>
          <h1 id="page-title">Inicio</h1>
        </div>
        <div class="top-right">
          ${user.isDemo ? html`<span class="badge badge-warning"><i class="fas fa-flask"></i> Modo demo</span>` : ''}
          <span class="chip"><i class="fas fa-building"></i> ${user.company || 'Mi empresa'}</span>
          <span class="chip"><i class="fas fa-calendar"></i> ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
          <span class="badge" id="plan-badge">${plan.name}</span>
          <a class="btn btn-primary btn-sm" href="#/nomina" aria-label="Nueva liquidación"><i class="fas fa-plus"></i> <span>Nueva liquidación</span></a>
        </div>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar" aria-label="Acceso rápido">
      ${TABS.map((id) => modules.find((m) => m.id === id)).filter(Boolean).map((m) => html`<a class="tab-link" href="#/${m.id}" data-nav="${m.id}"><i class="fas ${m.icon}"></i><span>${m.short || m.title}</span></a>`)}
      <button type="button" class="tab-link" data-action="open-nav"><i class="fas fa-bars-staggered"></i><span>Menú</span></button>
    </nav>
  </div>`;
}
