/** Configuración general de la aplicación (marca, rutas, contacto, flags). */

export const APP = {
  name: 'Nomina AR',
  edition: 'PRO',
  version: '2026.10',
  legalRevision: 'Octubre 2026',
  whatsapp: '5492613863563', // 261 3863563 (formato internacional para wa.me)
  contactEmail: 'miguelcoronell94@gmail.com',
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
  terms: at('pages/terminos.html'),
  privacy: at('pages/privacidad.html'),
  cookies: at('pages/cookies.html'),
  root: ROOT.href,
};

export const FLAGS = {
  /** Si es true, el plan "free" tiene los límites definidos en plans.config.js. */
  enforcePlanLimits: false,
};

/** Redes sociales: completá la URL de cada una y aparece activa en el pie de página. */
export const SOCIAL = {
  instagram: '',
  facebook: '',
  linkedin: '',
  x: '',
  youtube: '',
  tiktok: '',
};
