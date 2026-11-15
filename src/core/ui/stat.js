import { html } from '../html.js';

/**
 * Valor de una tarjeta de estadística. Expone la cantidad de caracteres como --len
 * para que el CSS (container queries) reduzca la tipografía y el monto se vea siempre completo.
 */
export const statValue = (text, title = text) => html`<strong class="stat-value" style="--len:${String(text).length}" title="${title}">${text}</strong>`;
