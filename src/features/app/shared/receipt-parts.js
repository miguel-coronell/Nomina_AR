/** Piezas HTML compartidas por los recibos en pantalla/impresión (misma estructura que los PDF). */
import { html, raw } from '../../../core/html.js';
import { money, percent, number } from '../../../core/format.js';
import { textoSobre } from '../../../domain/payroll/costo.js';

export const rgb = (c) => `rgb(${c.join(',')})`;

/** Logo del emisor (data URL guardada en Configuración). */
export const logoImg = (estudio) => (estudio?.logo?.data
  ? html`<img class="r-logo" src="${estudio.logo.data}" alt="Logo de ${estudio.razonSocial || 'la empresa'}">` : '');

/** Gráfico de dona con SVG. */
export function pieSVG(slices, size = 118) {
  const total = slices.reduce((a, s) => a + s.monto, 0);
  if (!(total > 0)) return '';
  const R = size / 2 - 1, r = R * 0.5, c = size / 2;
  const pt = (a, rad) => `${(c + rad * Math.cos(a)).toFixed(2)} ${(c + rad * Math.sin(a)).toFixed(2)}`;
  let a = -Math.PI / 2;
  const paths = [];
  const arc = (from, to, color) => {
    const large = to - from > Math.PI ? 1 : 0;
    paths.push(`<path d="M${pt(from, R)} A${R} ${R} 0 ${large} 1 ${pt(to, R)} L${pt(to, r)} A${r} ${r} 0 ${large} 0 ${pt(from, r)} Z" fill="${rgb(color)}" stroke="#fff" stroke-width="1"/>`);
  };
  slices.forEach((s) => {
    const sweep = (s.monto / total) * Math.PI * 2;
    if (sweep > Math.PI * 2 - 0.001) { arc(a, a + Math.PI, s.color); arc(a + Math.PI, a + Math.PI * 2 - 0.0001, s.color); }
    else arc(a, a + sweep, s.color);
    a += sweep;
  });
  return raw(`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Composición del costo laboral">${paths.join('')}</svg>`);
}

export const seccion = (n, titulo) => html`<div class="r-sec">${n ? `${n}. ` : ''}${titulo}</div>`;

/** Sección 2: contribuciones a cargo del empleador. */
export const contribucionesHTML = (costo) => html`
  <table class="r-tbl">
    <thead><tr><th>Concepto</th><th class="num">Base de cálculo</th><th class="num">%</th><th class="num">Importe</th></tr></thead>
    <tbody>${costo.contribuciones.length
      ? costo.contribuciones.map((c) => html`<tr><td>${c.label}</td><td class="num">${money(c.base)}</td><td class="num">${percent(c.pct)}</td><td class="num">${money(c.monto)}</td></tr>`)
      : html`<tr><td colspan="4"><small>Sin contribuciones configuradas (ver Configuración).</small></td></tr>`}</tbody>
    <tfoot><tr class="total"><td colspan="3">Subtotal contribuciones del empleador</td><td class="num">${money(costo.totalContribuciones)}</td></tr></tfoot>
  </table>`;

/** Resumen del costo laboral por rubro + gráfico (barra formal, torta o ninguno). */
export const resumenCostoHTML = (costo) => {
  const estilo = costo.estilo || 'barra';
  const sw = estilo !== 'ninguno';
  const barra = estilo === 'barra' ? html`<div class="r-bar-wrap"><small>Distribución del costo laboral total</small>
    <div class="r-bar">${costo.slices.map((s) => html`<span style="width:${s.pct}%;background:${rgb(s.color)};color:${rgb(textoSobre(s.color))}">${s.pct >= 6 ? number(s.pct.toFixed(1)) + '%' : ''}</span>`)}</div></div>` : '';
  return html`
  <div class="r-costo ${estilo === 'torta' ? 'con-torta' : ''}">
    <table class="r-tbl">
      <thead><tr>${sw ? html`<th></th>` : ''}<th>Rubro</th><th class="num">Aporte del trabajador</th><th class="num">Contribución del empleador</th><th class="num">Total</th><th class="num">%</th></tr></thead>
      <tbody>${costo.slices.map((s) => html`<tr>${sw ? html`<td class="sw"><i style="background:${rgb(s.color)}"></i></td>` : ''}<td>${s.label}</td>
        <td class="num">${s.aporte ? money(s.aporte) : ''}</td><td class="num">${s.contribucion ? money(s.contribucion) : ''}</td><td class="num">${money(s.monto)}</td><td class="num">${number(s.pct.toFixed(1))}%</td></tr>`)}</tbody>
      <tfoot><tr class="total">${sw ? html`<td></td>` : ''}<td>COSTO LABORAL TOTAL</td><td class="num">${money(costo.totalAportes)}</td><td class="num">${money(costo.totalContribuciones)}</td><td class="num">${money(costo.costoTotal)}</td><td class="num">100%</td></tr></tfoot>
    </table>
    ${estilo === 'torta' ? html`<div class="r-pie">${pieSVG(costo.slices)}</div>` : ''}
  </div>${barra}`;
};

/** Cuadro de datos en pares rótulo/valor. */
export const datosHTML = (pairs) => html`<div class="r-data">${pairs.map(([k, v]) => html`<div><b>${k}</b><span>${v || '—'}</span></div>`)}</div>`;
