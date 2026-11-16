import { $, $$ } from '../../core/dom.js';
import { html } from '../../core/html.js';
import { APP, ROUTES } from '../../config/app.config.js';
import { currentUser } from '../../services/auth.service.js';
import { mountChatbot } from './chatbot.js';
import { mountFooter } from '../shared/site-footer.js';

mountFooter();
// Cifras verificables (no métricas de uso): el MARKETING.stats de ejemplo queda solo para el login.
const HERO_FACTS = [
  { icon: 'fa-gavel', value: 'LCT + Ley 27.802', label: 'Marco legal' },
  { icon: 'fa-file-pdf', value: '1 hoja A4', label: 'Recibos y fichas en PDF' },
  { icon: 'fa-robot', value: 'Asistente', label: 'Simulador en el chat' },
];
$('#hero-stats').innerHTML = HERO_FACTS.map((s) => html`<div><i class="fas ${s.icon}"></i><div><strong>${s.value}</strong><span>${s.label}</span></div></div>`).join('');

const nav = $('#mobile-nav');
$('#burger').addEventListener('click', () => nav.classList.toggle('open'));
$$('a', nav).forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));

mountChatbot();

// Si ya hay sesión, el botón de acceso lleva directo al panel.
currentUser().then((u) => {
  if (!u) return;
  const b = $('#btn-login');
  b.href = ROUTES.app; b.textContent = 'Ir a mi panel';
}).catch(() => {});

// Animación de entrada al hacer scroll + botón "volver arriba" + sombra del encabezado.
document.documentElement.classList.add('js');
const reveal = [...$$('.reveal')];
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  reveal.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 70}ms`; io.observe(el); });
} else reveal.forEach((el) => el.classList.add('in'));
const toTop = $('#to-top'), header = $('.site-header');
const onScroll = () => { toTop.classList.toggle('show', scrollY > 700); header.classList.toggle('scrolled', scrollY > 8); };
addEventListener('scroll', onScroll, { passive: true }); onScroll();
