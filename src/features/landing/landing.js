import { $, $$ } from '../../core/dom.js';
import { html } from '../../core/html.js';
import { MARKETING } from '../../config/marketing.config.js';
import { APP, ROUTES } from '../../config/app.config.js';
import { currentUser } from '../../services/auth.service.js';
import { mountQuickSimulator } from './quick-simulator.js';

$('#year').textContent = new Date().getFullYear();
$('#rev').textContent = APP.legalRevision;
$('#wa-link').href = `https://wa.me/${APP.whatsapp}`;
$('#hero-stats').innerHTML = MARKETING.stats.map((s) => html`<div><strong>${s.value}</strong><span>${s.label}</span></div>`).join('');

const nav = $('#mobile-nav');
$('#burger').addEventListener('click', () => nav.classList.toggle('open'));
$$('a', nav).forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

mountQuickSimulator($('#quick-sim'));

// Si ya hay sesión, el botón de acceso lleva directo al panel.
currentUser().then((u) => {
  if (!u) return;
  const b = $('#btn-login');
  b.href = ROUTES.app; b.textContent = 'Ir a mi panel';
}).catch(() => {});
