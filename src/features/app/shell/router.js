import { html } from '../../../core/html.js';

/** Router por hash: #/<id-modulo>?param=valor */
export function createRouter({ modules, container, ctx, onChange }) {
  let cleanup;
  let token = 0;

  const parse = () => {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    return { id: path || modules[0].id, params: new URLSearchParams(query) };
  };

  async function resolve() {
    const { id, params } = parse();
    const mod = modules.find((m) => m.id === id) || modules[0];
    const mine = ++token;
    try { cleanup?.(); } catch (e) { console.error(e); }
    cleanup = undefined;
    // Cada montaje recibe un contenedor NUEVO: así los listeners del módulo anterior
    // se descartan con él y no se acumulan al volver a visitar una sección.
    const host = document.createElement('div');
    host.className = 'view-host';
    host.innerHTML = html`<div class="empty"><i class="fas fa-circle-notch spin"></i></div>`;
    container.replaceChildren(host);
    onChange?.(mod);
    try {
      const result = await mod.mount(host, ctx, params);
      if (mine !== token) { try { result?.(); } catch { /* noop */ } return; }
      cleanup = typeof result === 'function' ? result : undefined;
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      if (mine !== token) return;
      host.innerHTML = html`
        <div class="card"><div class="card-body empty">
          <i class="fas fa-triangle-exclamation"></i>
          <h4>No pudimos cargar esta sección</h4>
          <p>${err?.code === 'permission-denied' ? 'Sin permisos en Firestore. Revisá las reglas de seguridad.' : 'Revisá tu conexión e intentá de nuevo.'}</p>
          <button class="btn btn-outline" style="margin-top:1rem" onclick="location.reload()">Reintentar</button>
        </div></div>`;
    }
  }

  return {
    start() { window.addEventListener('hashchange', resolve); return resolve(); },
    go(path) { const h = `#/${path.replace(/^#?\/?/, '')}`; if (location.hash === h) resolve(); else location.hash = h; },
    current: () => parse().id,
  };
}
