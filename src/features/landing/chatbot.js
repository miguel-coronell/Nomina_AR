/** Asistente de la landing: guía al usuario y aloja el simulador (antes era una sección de la página). */
import { APP, ROUTES } from '../../config/app.config.js';
import { mountQuickSimulator } from './quick-simulator.js';

const CHIPS = [
  { id: 'sim', icon: 'fa-calculator', label: 'Simular liquidación' },
  { id: 'como', icon: 'fa-list-check', label: 'Cómo funciona' },
  { id: 'recibos', icon: 'fa-file-signature', label: 'Recibos y firma digital' },
  { id: 'planes', icon: 'fa-crown', label: 'Planes y precios' },
  { id: 'ley', icon: 'fa-scale-balanced', label: 'Marco legal' },
  { id: 'contacto', icon: 'fa-headset', label: 'Hablar con una persona' },
];

const wa = (t = 'Hola, quiero consultar sobre Nomina AR') => `https://wa.me/${APP.whatsapp}?text=${encodeURIComponent(t)}`;
const A = (href, icon, text, cls = '') => `<a class="cb-link ${cls}" href="${href}" target="_blank" rel="noopener"><i class="${icon}"></i> ${text}</a>`;
const L = (href, icon, text) => `<a class="cb-link" href="${href}"><i class="${icon}"></i> ${text}</a>`;

const REPLIES = {
  como: () => `<b><i class="fas fa-list-check"></i> Cómo funciona</b><ol><li><i class="fas fa-users"></i> Cargá tu personal o importá tu planilla de Excel.</li><li><i class="fas fa-calendar-check"></i> Liquidá el período con las novedades del mes.</li><li><i class="fas fa-paper-plane"></i> Pagá, imprimí el PDF o enviá el recibo por WhatsApp.</li></ol>${L(ROUTES.login + '?modo=registro', 'fas fa-user-plus', 'Crear cuenta')}`,
  recibos: () => `<b><i class="fas fa-file-signature"></i> Recibos de haberes</b><p>Se generan en PDF, A4, con original y duplicado. Podés <b>firmar digitalmente</b> con un interruptor, tanto el empleador como el empleado, y la firma queda sellada con fecha y hora en el recibo.</p>${L(ROUTES.login + '?modo=registro', 'fas fa-user-plus', 'Probarlo con mi cuenta')}`,
  planes: () => `<b><i class="fas fa-crown"></i> Planes</b><p>Podés empezar gratis y pasar a PRO cuando necesites más empleados y recibos.</p>${L(ROUTES.plans, 'fas fa-tags', 'Ver planes')}`,
  ley: () => `<b><i class="fas fa-scale-balanced"></i> Marco legal</b><p>El motor aplica la LCT 20.744 y la Ley 27.802: art. 245 con tope y fallo Vizzoti, preaviso, integración, SAC y vacaciones. Son estimaciones orientativas: verificalas con un profesional matriculado.</p>`,
  contacto: () => `<b><i class="fas fa-headset"></i> Te atiende una persona</b><p>Escribinos y te respondemos a la brevedad.</p>${A(wa(), 'fab fa-whatsapp', 'WhatsApp 261 386-3563', 'wa')}${A(`mailto:${APP.contactEmail}`, 'fas fa-envelope', APP.contactEmail)}`,
  datos: () => `<b><i class="fas fa-lock"></i> Tus datos</b><p>Con tu cuenta se guardan por usuario en la nube. Podés ingresar con Google o con correo y contraseña.</p>`,
  hola: () => `¡Hola! 👋 Soy el asistente de <b>${APP.name}</b>. Puedo calcular una liquidación, explicarte cómo funciona o ponerte en contacto con nosotros. ¿Qué querés hacer?`,
};

const MATCH = [
  [/simul|calcul|liquid|indemn|despid|preaviso|sac|vacac/, 'sim'],
  [/firma|recibo|pdf|sueldo|haber/, 'recibos'],
  [/plan|precio|costo|pro\b|pagar|gratis/, 'planes'],
  [/ley|legal|lct|27\.?802|norma|art/, 'ley'],
  [/whats|mail|correo|contacto|persona|humano|ayuda|soporte|telefono|tel[eé]fono/, 'contacto'],
  [/como|c[oó]mo|funciona|empez|usar|paso/, 'como'],
  [/dato|seguridad|nube|privacidad/, 'datos'],
];

export function mountChatbot() {
  const root = document.createElement('div');
  root.className = 'cb';
  root.innerHTML = `
    <button class="cb-fab" id="cb-fab" aria-label="Abrir asistente" aria-expanded="false"><i class="fas fa-comment-dots cb-i-open"></i><i class="fas fa-xmark cb-i-close"></i><span class="cb-dot"></span></button>
    <section class="cb-panel" id="cb-panel" role="dialog" aria-label="Asistente ${APP.name}" hidden>
      <header class="cb-head"><span class="cb-avatar"><i class="fas fa-robot"></i></span><div><strong>Asistente ${APP.name}</strong><small><i class="fas fa-circle"></i> En línea</small></div>
        <button class="cb-x" data-close aria-label="Cerrar"><i class="fas fa-minus"></i></button></header>
      <div class="cb-body" id="cb-body" aria-live="polite"></div>
      <div class="cb-chips" id="cb-chips"></div>
      <form class="cb-form" id="cb-form" autocomplete="off"><input class="cb-input" id="cb-input" placeholder="Escribí tu consulta…" aria-label="Mensaje"><button class="cb-send" aria-label="Enviar"><i class="fas fa-paper-plane"></i></button></form>
    </section>`;
  document.body.appendChild(root);

  const $q = (s) => root.querySelector(s);
  const fab = $q('#cb-fab'), panel = $q('#cb-panel'), body = $q('#cb-body'), chips = $q('#cb-chips'), form = $q('#cb-form'), input = $q('#cb-input');
  let started = false;

  const scroll = () => { body.scrollTop = body.scrollHeight; };
  const bot = (inner, cls = '') => { const d = document.createElement('div'); d.className = `cb-msg bot ${cls}`; d.innerHTML = `<span class="cb-av"><i class="fas fa-robot"></i></span><div class="cb-bub">${inner}</div>`; body.appendChild(d); scroll(); return d; };
  const me = (text) => { const d = document.createElement('div'); d.className = 'cb-msg me'; const b = document.createElement('div'); b.className = 'cb-bub'; b.textContent = text; d.appendChild(b); body.appendChild(d); scroll(); };
  const typing = (fn) => { const t = bot('<span class="cb-typing"><i></i><i></i><i></i></span>'); setTimeout(() => { t.remove(); fn(); }, 450); };

  function showSim() {
    const d = bot('<b><i class="fas fa-calculator"></i> Simulador de liquidación final</b><p>Completá los 3 pasos y te muestro el neto estimado.</p><div class="sim-card chat-sim"></div>', 'wide');
    mountQuickSimulator(d.querySelector('.chat-sim'));
  }
  function answer(id) {
    typing(() => { if (id === 'sim') showSim(); else bot(REPLIES[id]()); renderChips(); });
  }
  function renderChips() {
    chips.innerHTML = CHIPS.map((c) => `<button type="button" data-id="${c.id}"><i class="fas ${c.icon}"></i> ${c.label}</button>`).join('');
  }
  function open(id) {
    panel.hidden = false; requestAnimationFrame(() => root.classList.add('open'));
    fab.setAttribute('aria-expanded', 'true'); fab.classList.add('seen');
    if (!started) { started = true; bot(REPLIES.hola()); renderChips(); }
    if (id) { const c = CHIPS.find((x) => x.id === id); if (c) me(c.label); answer(id); } else input.focus();
  }
  function close() { root.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); setTimeout(() => { if (!root.classList.contains('open')) panel.hidden = true; }, 200); }

  fab.addEventListener('click', () => (root.classList.contains('open') ? close() : open()));
  $q('[data-close]').addEventListener('click', close);
  chips.addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; me(b.textContent.trim()); answer(b.dataset.id); });
  form.addEventListener('submit', (e) => {
    e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; me(q);
    const hit = MATCH.find(([re]) => re.test(q.toLowerCase()));
    if (hit) answer(hit[1]);
    else typing(() => { bot(`No estoy seguro de haber entendido. Elegí una opción o escribinos y te ayudamos:<br>${A(wa(q), 'fab fa-whatsapp', 'Consultar por WhatsApp', 'wa')}`); renderChips(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-open-bot]'); if (!t) return; e.preventDefault(); const nav = document.getElementById('mobile-nav'); nav?.classList.remove('open'); open(t.dataset.openBot); });
  if (location.hash === '#simulador') open('sim');
  setTimeout(() => { if (!started) fab.classList.add('nudge'); }, 4000);
}
