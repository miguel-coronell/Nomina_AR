/** Simulador público de 3 pasos de la landing. Reutiliza el mismo motor que la app. */
import { html } from '../../core/html.js';
import { $, on, readForm } from '../../core/dom.js';
import { money } from '../../core/format.js';
import { APP, ROUTES } from '../../config/app.config.js';
import { liquidar, ValidationError } from '../../domain/liquidation/index.js';
import { MOTIVOS, motivoLabel } from '../../domain/legal/params.js';
import { DEFAULT_SETTINGS } from '../../services/settings.service.js';

export function mountQuickSimulator(root) {
  let step = 1;
  const data = { motivo: 'despido_sin_causa', preavisoOtorgado: false };

  const steps = () => html`
    <div class="stepper">
      ${[['Vínculo'], ['Remuneración'], ['Resultado']].map(([l], i) => html`
        <div class="step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}"><b>${i + 1}</b><span>${l}</span></div>`)}
    </div>`;

  const err = (e, k) => (e?.[k] ? html`<span class="error">${e[k]}</span>` : '');

  function view(errors) {
    if (step === 1) return html`
      <h3>Datos del vínculo</h3><p class="desc">¿Cómo terminó la relación laboral?</p>
      <form class="form-grid" data-step="1" novalidate>
        <div class="field full"><label>Motivo de egreso</label><select class="select" name="motivo">${MOTIVOS.map((m) => html`<option value="${m.id}" ${data.motivo === m.id ? 'selected' : ''}>${m.label}</option>`)}</select></div>
        <div class="field ${errors?.fechaIngreso ? 'has-error' : ''}"><label>Fecha de ingreso</label><input class="input" type="date" name="fechaIngreso" value="${data.fechaIngreso || ''}">${err(errors, 'fechaIngreso')}</div>
        <div class="field ${errors?.fechaEgreso ? 'has-error' : ''}"><label>Fecha de egreso</label><input class="input" type="date" name="fechaEgreso" value="${data.fechaEgreso || ''}">${err(errors, 'fechaEgreso')}</div>
        <div class="step-actions full" style="grid-column:1/-1"><span></span><button class="btn btn-primary" type="submit">Siguiente <i class="fas fa-arrow-right"></i></button></div>
      </form>`;
    if (step === 2) return html`
      <h3>Remuneración</h3><p class="desc">Usá la mejor remuneración mensual normal y habitual (bruta).</p>
      <form class="form-grid" data-step="2" novalidate>
        <div class="field ${errors?.sueldo ? 'has-error' : ''}"><label>Remuneración mensual</label><input class="input" type="number" step="0.01" min="0" name="sueldo" value="${data.sueldo || ''}" placeholder="0,00">${err(errors, 'sueldo')}</div>
        <div class="field"><label>Tope de convenio (opcional)</label><input class="input" type="number" step="0.01" min="0" name="topeConvenio" value="${data.topeConvenio || ''}"></div>
        <label class="check full"><input type="checkbox" name="preavisoOtorgado" ${data.preavisoOtorgado ? 'checked' : ''}><span>El empleador otorgó el preaviso</span></label>
        <div class="step-actions full" style="grid-column:1/-1"><button class="btn btn-outline" type="button" data-back><i class="fas fa-arrow-left"></i> Atrás</button><button class="btn btn-primary" type="submit">Calcular <i class="fas fa-calculator"></i></button></div>
      </form>`;
    const r = liquidar(data, DEFAULT_SETTINGS);
    return html`
      <div class="result-hero"><small>Neto estimado a cobrar</small><strong>${money(r.totals.neto)}</strong><small>${motivoLabel(r.input.motivo)} · Antigüedad ${r.antiguedad.texto}</small></div>
      ${r.warnings.map((w) => html`<div class="alert alert-warning" style="margin-bottom:.8rem"><i class="fas fa-triangle-exclamation"></i><div>${w}</div></div>`)}
      <div class="table-wrap"><table class="table"><tbody>
        ${r.rubros.map((x) => html`<tr><td>${x.label}<br><small class="muted-text">${x.ref}</small></td><td class="num">${money(x.amount)}</td></tr>`)}
        ${r.deducciones.map((d) => html`<tr><td>${d.label}</td><td class="num" style="color:var(--danger)">− ${money(d.amount)}</td></tr>`)}
      </tbody><tfoot><tr><td>Neto</td><td class="num">${money(r.totals.neto)}</td></tr></tfoot></table></div>
      <div class="cta-box"><p>Guardá este cálculo, gestioná empleados y generá el recibo en PDF con una cuenta gratuita.</p><a class="btn btn-primary" href="${ROUTES.login}?modo=registro">Crear cuenta gratis</a></div>
      <div class="step-actions"><button class="btn btn-outline" data-back><i class="fas fa-pen"></i> Editar datos</button>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-ghost" data-whatsapp><i class="fab fa-whatsapp"></i> Compartir</button><button class="btn btn-ghost" data-restart>Nueva simulación</button></div></div>
      <p class="muted-text" style="font-size:.78rem;margin-top:1rem">Estimación orientativa con aportes por defecto. No reemplaza el criterio de un profesional matriculado.</p>`;
  }

  function draw(errors) {
    root.innerHTML = html`${steps()}<div class="sim-body">${view(errors)}</div>`;
  }

  on(root, 'submit', 'form', (e, form) => {
    e.preventDefault();
    Object.assign(data, readForm(form));
    try {
      liquidar({ ...{ fechaIngreso: '2000-01-01', fechaEgreso: '2000-01-02', sueldo: 1 }, ...data, ...(step === 1 ? { sueldo: 1 } : {}) }, DEFAULT_SETTINGS);
    } catch (ex) {
      if (ex instanceof ValidationError) {
        const relevant = step === 1 ? ['fechaIngreso', 'fechaEgreso', 'motivo'] : ['sueldo'];
        const errs = Object.fromEntries(Object.entries(ex.errors).filter(([k]) => relevant.includes(k)));
        if (Object.keys(errs).length) return draw(errs);
      } else throw ex;
    }
    step += 1; draw();
  });
  on(root, 'click', '[data-back]', () => { step = Math.max(1, step - 1); draw(); });
  on(root, 'click', '[data-restart]', () => { step = 1; Object.keys(data).forEach((k) => delete data[k]); data.motivo = 'despido_sin_causa'; draw(); });
  on(root, 'click', '[data-whatsapp]', () => {
    const r = liquidar(data, DEFAULT_SETTINGS);
    const msg = `Simulación ${APP.name} PRO\n${motivoLabel(r.input.motivo)}\nAntigüedad: ${r.antiguedad.texto}\nNeto estimado: ${money(r.totals.neto)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  draw();
}
