import { currentUser } from '../services/auth.service.js';
import { ROUTES } from '../config/app.config.js';

/** Exige sesión. Si no hay, redirige al login recordando a dónde volver. */
export async function requireAuth() {
  const user = await currentUser();
  if (!user) {
    const next = encodeURIComponent(location.href);
    location.replace(`${ROUTES.login}?next=${next}`);
    return new Promise(() => {}); // frena la ejecución mientras redirige
  }
  return user;
}

/** Valida que el destino post-login pertenezca a este mismo sitio. */
export function safeNext(raw) {
  try {
    const url = new URL(raw, location.href);
    return url.href.startsWith(ROUTES.root) ? url.href : ROUTES.app;
  } catch { return ROUTES.app; }
}
