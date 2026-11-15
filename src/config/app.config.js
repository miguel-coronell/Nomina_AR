/** Configuración general de la aplicación (marca, rutas, contacto, flags). */

export const APP = {
  name: 'ArgenLiquid',
  edition: 'PRO',
  version: '2026.10',
  legalRevision: 'Octubre 2026',
  whatsapp: '5491122334455', // ← reemplazar por el número real de ventas/soporte
  contactEmail: '',          // ← opcional
};

/** Raíz del sitio, calculada desde este archivo (funciona en subcarpetas, GitHub Pages, etc.). */
const ROOT = new URL('../../', import.meta.url);
const at = (p) => new URL(p, ROOT).href;

export const ROUTES = {
  home: at('index.html'),
  login: at('pages/login.html'),
  plans: at('pages/planes.html'),
  app: at('pages/app.html'),
  appSection: (section) => `${at('pages/app.html')}#/${section}`,
  root: ROOT.href,
};

export const FLAGS = {
  /** Si es true, el plan "free" tiene los límites definidos en plans.config.js. */
  enforcePlanLimits: false,
};
