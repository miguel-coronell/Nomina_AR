/**
 * Pregunta qué formato de recibo usar (Clásico u Completo) cada vez que se descarga, imprime o comparte.
 *   const fmt = await elegirFormatoRecibo(ctx, { accion: 'Descargar' });   // 'clasico' | 'completo' | null (cancelado)
 *   const est = estConFormato(ctx, fmt);                                   // estudio con el formato elegido
 * El formato guardado en Configuración queda como opción sugerida (resaltada), pero siempre se consulta.
 */
import { formatoRecibo } from '../../../domain/payroll/clasico.js';

const OPCIONES = [
  ['clasico', 'fa-table-columns', 'Clásico de empresa', 'Horizontal: original y duplicado en una hoja A4.'],
  ['completo', 'fa-file-invoice-dollar', 'Completo (art. 140 LCT)', 'Vertical: 4 secciones y resumen de costo laboral.'],
];

export const estConFormato = (ctx, fmt) => ({ ...ctx.state.settings.estudio, reciboFormato: fmt });

export function elegirFormatoRecibo(ctx, { accion = 'Descargar', detalle = '' } = {}) {
  return new Promise((resolve) => {
    let decidido = false;
    const fin = (v) => { if (!decidido) { decidido = true; resolve(v); } };
    const sugerido = formatoRecibo(ctx.state.settings.estudio);
    const body = document.createElement('div');
    body.innerHTML = `${detalle ? `<p class="muted-text" style="margin:0 0 .8rem">${detalle}</p>` : ''}
      <div class="fmt-opts">${OPCIONES.map(([k, ico, t, d]) => `
        <button type="button" class="fmt-opt ${k === sugerido ? 'is-default' : ''}" data-fmt="${k}">
          <i class="fas ${ico}" aria-hidden="true"></i>
          <span><b>${t}</b><small>${d}</small></span>
        </button>`).join('')}</div>`;
    const m = ctx.openModal({ title: `${accion} recibo: elegí el formato`, body, size: 'sm', icon: 'fa-file-invoice-dollar', onClose: () => fin(null) });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fmt]');
      if (!b) return;
      fin(b.dataset.fmt); m.close();
    });
  });
}
