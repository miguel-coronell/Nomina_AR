/** Pie de página completo (sin iconos en los enlaces), compartido por landing, planes y páginas legales. */
import { APP, ROUTES, SOCIAL } from '../../config/app.config.js';

const NETS = [
  ['instagram', 'fab fa-instagram', 'Instagram'], ['facebook', 'fab fa-facebook-f', 'Facebook'], ['linkedin', 'fab fa-linkedin-in', 'LinkedIn'],
  ['x', 'fab fa-x-twitter', 'X'], ['youtube', 'fab fa-youtube', 'YouTube'], ['tiktok', 'fab fa-tiktok', 'TikTok'],
];
const home = (h) => `${ROUTES.home}${h}`;
const logo = new URL('../../../assets/logo.svg', import.meta.url).href;
const list = (items) => items.map(([t, h, ext]) => `<li><a href="${h}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a></li>`).join('');

export function mountFooter(el = document.getElementById('site-footer')) {
  if (!el) return;
  const social = NETS.map(([k, ic, name]) => SOCIAL[k]
    ? `<a href="${SOCIAL[k]}" target="_blank" rel="noopener" aria-label="${name}" title="${name}"><i class="${ic}"></i></a>`
    : `<span class="off" aria-label="${name} (próximamente)" title="${name} · próximamente"><i class="${ic}"></i></span>`).join('');
  const wa = `https://wa.me/${APP.whatsapp}?text=${encodeURIComponent('Hola, quiero consultar sobre Nomina AR')}`;
  const col = (title, items) => `<nav aria-label="${title}"><h5>${title}</h5><ul>${list(items)}</ul></nav>`;
  el.innerHTML = `
    <div class="container">
      <div class="ft-top">
        <div class="ft-brand">
          <a class="brand" href="${ROUTES.home}"><span class="brand-mark"><img src="${logo}" alt="" width="40" height="40"></span><span>${APP.name} <small>PRO</small></span></a>
          <p>Liquidaciones laborales y recibos de haberes en PDF con firma digital, para abogados, contadores, estudios y equipos de RR.HH. de Argentina.</p>
          <div class="ft-social" aria-label="Redes sociales">${social}</div>
        </div>
        <div class="ft-cta">
          <strong>¿Tenés dudas? Hablemos.</strong>
          <span>Te respondemos por WhatsApp o por correo.</span>
          <div><a class="ft-ico wa" href="${wa}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp" title="WhatsApp"><i class="fab fa-whatsapp"></i></a><a class="ft-ico mail" href="mailto:${APP.contactEmail}" aria-label="Escribinos por correo" title="Correo"><i class="fas fa-envelope"></i></a></div>
        </div>
      </div>
      <div class="ft-grid">
        ${col('Producto', [['Servicios', home('#servicios')], ['Cómo funciona', home('#como-funciona')], ['Simulador', home('#simulador')], ['Planes y precios', ROUTES.plans], ['Acceso clientes', ROUTES.login], ['Crear cuenta', `${ROUTES.login}?modo=registro`]])}
        ${col('Según tu situación', [['Despido sin causa', home('#simulador')], ['Renuncia y egreso', home('#simulador')], ['Vacaciones y SAC', home('#servicios')], ['Recibos con firma digital', home('#servicios')], ['Nómina mensual y quincenal', home('#servicios')]])}
        ${col('Para quién', [['Abogados laboralistas', home('#servicios')], ['Contadores y estudios', home('#servicios')], ['Equipos de RR.HH.', home('#servicios')], ['Constructoras (UOCRA)', home('#servicios')], ['Pasantías educativas', home('#servicios')]])}
        ${col('Recursos', [['Marco legal', home('#normativa')], ['Preguntas frecuentes', home('#preguntas')], ['Ley 27.802', home('#normativa')], ['Defensa del Consumidor', 'https://www.argentina.gob.ar/produccion/defensadelconsumidor', 1]])}
        ${col('Legal', [['Términos y condiciones', ROUTES.terms], ['Política de privacidad', ROUTES.privacy], ['Política de cookies', ROUTES.cookies], ['Botón de arrepentimiento', `mailto:${APP.contactEmail}?subject=${encodeURIComponent('Botón de arrepentimiento')}`]])}
      </div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${APP.name} PRO · Hecho en Argentina. Todos los derechos reservados.</span><span>Estimaciones orientativas · Marco legal revisado: ${APP.legalRevision}</span></div>
    </div>`;
}
