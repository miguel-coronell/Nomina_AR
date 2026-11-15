import { html } from '../../../../core/html.js';
import { ARTICULOS, ARTICULOS_RRHH, MULTAS, MULTAS_NOTA, CONVENIOS, AVISO_LEGAL, ESTRUCTURA_RECIBO, ESTRUCTURA_LIQUIDACION } from '../../../../domain/legal/articles.js';
import { FECHAS_LEGALES, PERIODO_PRUEBA } from '../../../../domain/legal/params.js';
import { dateAR } from '../../../../core/format.js';
import { APP } from '../../../../config/app.config.js';

export default {
  id: 'normativa', title: 'Ayuda', icon: 'fa-circle-question', group: 'Recursos',

  mount(el, ctx) {
    const e = ctx?.state?.settings?.estudio || {};
    const config = [['Razón social', e.razonSocial], ['CUIT', e.cuit], ['Domicilio', e.domicilio], ['Lugar de pago', e.lugarPago], ['Logo', e.logo]];
    const estructura = (E) => html`<div class="card"><div class="card-header"><h3>${E.titulo}</h3></div><div class="card-body">
      <p class="muted-text" style="font-size:.8rem;margin-bottom:.6rem">${E.base}</p>
      <ul class="list-plain">${E.items.map(([req, donde]) => html`<li><div class="t" style="white-space:normal"><strong style="white-space:normal;font-weight:600">${req}</strong><small><i class="fas fa-circle-check" style="color:var(--success)"></i> ${donde}</small></div></li>`)}</ul></div></div>`;
    el.innerHTML = html`
      <div class="page-head"><div><h2>Base legal y referencias</h2><p>Reglas que aplica el motor de cálculo. Última revisión: ${APP.legalRevision}.</p></div></div>
      <div class="alert alert-info" style="margin-bottom:1.2rem"><i class="fas fa-scale-balanced"></i><div>${AVISO_LEGAL}</div></div>

      ${ctx ? html`<div class="card" style="margin-bottom:1.2rem"><div class="card-header"><h3>Estado de tus datos para los recibos</h3><a class="btn btn-outline btn-sm" href="#/configuracion">Completar en Configuración</a></div>
        <div class="card-body" style="display:flex;gap:.6rem;flex-wrap:wrap">${config.map(([k, v]) => html`<span class="badge ${v ? 'badge-success' : (k === 'Logo' ? 'badge-gray' : 'badge-warning')}"><i class="fas ${v ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${k}${v ? '' : (k === 'Logo' ? ' (opcional)' : ' · falta')}</span>`)}</div></div>` : ''}
      <div class="grid grid-2" style="margin-bottom:1.2rem">${estructura(ESTRUCTURA_RECIBO)}${estructura(ESTRUCTURA_LIQUIDACION)}</div>
      <div class="grid grid-2" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:start">
        <div class="accordion">
          ${[...ARTICULOS, ...ARTICULOS_RRHH].map((a, i) => html`<details ${i === 0 ? 'open' : ''}><summary><span><span class="ref-tag">${a.ref}</span>${a.titulo}</span></summary><p>${a.texto}</p></details>`)}
        </div>
        <div style="display:grid;gap:1.2rem">
          <div class="card"><div class="card-header"><h3>Marco aplicado por fecha de egreso</h3></div>
            <div class="card-body"><ul class="list-plain">
              <li><div class="t"><strong>Antes del ${dateAR(FECHAS_LEGALES.leyBases)}</strong><small>Período de prueba ${PERIODO_PRUEBA.previo} meses · multas históricas aplicables</small></div></li>
              <li><div class="t"><strong>Desde ${dateAR(FECHAS_LEGALES.leyBases)} (Ley 27.742)</strong><small>Prueba ${PERIODO_PRUEBA.leyBases} meses · multas derogadas</small></div></li>
              <li><div class="t"><strong>Desde ${dateAR(FECHAS_LEGALES.ley27802)} (Ley 27.802)</strong><small>Prueba ${PERIODO_PRUEBA.ley27802} meses · sin preaviso en prueba · nuevo Art. 245</small></div></li>
            </ul></div></div>
          <div class="card"><div class="card-header"><h3>Multas y sanciones</h3></div>
            <div class="card-body"><ul class="list-plain">${MULTAS.map((m) => html`<li><div class="t"><strong>${m.ref}</strong><small>${m.desc}</small></div><span class="badge badge-danger">Derogada</span></li>`)}</ul>
              <p class="muted-text" style="font-size:.82rem;margin-top:.8rem">${MULTAS_NOTA}</p></div></div>
          <div class="card"><div class="card-header"><h3>Convenios de referencia</h3></div>
            <div class="card-body"><ul class="list-plain">${CONVENIOS.map((c) => html`<li><div class="t"><strong>${c.nombre}</strong></div></li>`)}</ul></div></div>
        </div>
      </div>`;
  },
};
