import { html, raw } from '../../../../core/html.js';
import { $, $$, on, readForm, fillForm, debounce } from '../../../../core/dom.js';
import { money, percent } from '../../../../core/format.js';
import { isValidISO } from '../../../../core/dates.js';
import { liquidar, calcAntiguedad, ValidationError } from '../../../../domain/liquidation/index.js';
import { MOTIVOS, FECHAS_LEGALES, resolverMarcoLegal } from '../../../../domain/legal/params.js';
import { toRecord } from '../../../../services/liquidations.service.js';
import { exportReceiptPDF } from '../receipts/receipt.actions.js';
import { shareLiquidacion } from '../../shared/share.dialog.js';

const formHTML = (emps) => html`
  <form id="sim-form" class="form-grid" novalidate autocomplete="off">
    <div class="fieldset-title">Trabajador</div>
    <div class="field full"><label>Empleado guardado</label>
      <select class="select" name="employeeId"><option value="">— Cálculo manual —</option>${emps.map((e) => html`<option value="${e.id}">${e.nombre}${e.dni ? ' · ' + e.dni : ''}</option>`)}</select></div>
    <div class="field full"><label>Nombre (para el recibo)</label><input class="input" name="nombre" placeholder="Nombre y apellido"></div>

    <div class="fieldset-title">Vínculo</div>
    <div class="field full"><label>Motivo de egreso</label><select class="select" name="motivo">${MOTIVOS.map((m) => html`<option value="${m.id}">${m.label}</option>`)}</select></div>
    <div class="field"><label>Fecha de ingreso</label><input class="input" type="date" name="fechaIngreso"><span class="error" data-error="fechaIngreso"></span></div>
    <div class="field"><label>Fecha de egreso</label><input class="input" type="date" name="fechaEgreso"><span class="error" data-error="fechaEgreso"></span></div>
    <div class="antig-preview" id="antig" hidden></div>

    <div class="fieldset-title">Remuneración</div>
    <div class="field"><label>Mejor remuneración mensual normal y habitual</label><input class="input" type="number" step="0.01" min="0" name="sueldo" placeholder="0,00"><span class="error" data-error="sueldo"></span></div>
    <div class="field"><label>Tope indemnizatorio (3 × promedio CCT)</label><input class="input" type="number" step="0.01" min="0" name="topeConvenio" placeholder="Opcional"><span class="hint">Se aplica con el piso del 67% (Vizzoti).</span></div>
    <div class="field"><label>Horas extras al 50%</label><input class="input" type="number" min="0" step="1" name="he50" placeholder="0"></div>
    <div class="field"><label>Horas extras al 100%</label><input class="input" type="number" min="0" step="1" name="he100" placeholder="0"></div>
    <div class="field"><label>Vacaciones ya gozadas este año (días)</label><input class="input" type="number" min="0" step="0.5" name="diasVacacionesGozadas" placeholder="0"></div>
    <div class="field" id="acuerdo-field" hidden><label>Gratificación pactada (mutuo acuerdo)</label><input class="input" type="number" min="0" step="0.01" name="acuerdoMonto" placeholder="0,00"></div>

    <div class="fieldset-title">Opciones</div>
    <label class="check full" id="preaviso-check"><input type="checkbox" name="preavisoOtorgado"><span>El empleador otorgó el preaviso<small>Si no se marca y corresponde, se liquida el preaviso omitido y la integración del mes.</small></span></label>
    <div class="full" id="multas-box" style="display:grid;gap:.6rem">
      <label class="check"><input type="checkbox" name="multaArt80"><span>Sanción Art. 80 LCT (3 remuneraciones)</span></label>
      <label class="check"><input type="checkbox" name="multaArt1"><span>Ley 25.323 art. 1 — relación no registrada / deficiente</span></label>
      <label class="check"><input type="checkbox" name="multaArt2"><span>Ley 25.323 art. 2 — falta de pago en término (+50%)</span></label>
      <small class="hint" id="multas-hint"></small>
    </div>
    <div class="fieldset-title">Datos del recibo (opcionales)</div>
    <div class="field"><label>Fecha de pago</label><input class="input" type="date" name="fechaPago"></div>
    <div class="field"><label>Lugar de pago</label><input class="input" name="lugarPago" placeholder="Ej: Mendoza, Capital"></div>
    <div class="field"><label>Forma de pago</label><select class="select" name="formaPago"><option value="">—</option><option value="transferencia">Transferencia bancaria</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="otro">Otro</option></select></div>
    <div class="field"><label>Último depósito de aportes — período</label><input class="input" name="depPeriodo" placeholder="MM/AAAA"></div>
    <div class="field"><label>Fecha del depósito</label><input class="input" type="date" name="depFecha"></div>
    <div class="field"><label>Banco del depósito</label><input class="input" name="depBanco" placeholder="Ej: Banco Nación"></div>
    <label class="field full"><span class="label">Notas</span><textarea class="textarea" name="notas" rows="2" placeholder="Acuerdos, observaciones…"></textarea></label>
  </form>`;

const rubroList = (items) => html`<ul class="rubro-list">${items.map((r) => html`
  <li><span class="l">${r.label}<small>${r.detail ? r.detail + ' · ' : ''}${r.ref}</small></span><span class="v">${money(r.amount)}</span></li>`)}</ul>`;

function resultHTML(r) {
  const { totals: t } = r;
  const hab = r.rubros.filter((x) => x.tipo !== 'multa');
  const mul = r.rubros.filter((x) => x.tipo === 'multa');
  return html`
    <div class="big-total">
      <small>Neto a cobrar</small><strong>${money(t.neto)}</strong>
      <div class="sub"><span>Bruto: <b>${money(t.bruto)}</b></span><span>Descuentos: <b>${money(t.deducciones)}</b></span><span>Antigüedad: <b>${r.antiguedad.texto}</b></span></div>
    </div>
    ${r.warnings.map((w) => html`<div class="alert alert-warning" style="margin-top:.8rem"><i class="fas fa-triangle-exclamation"></i><div>${w}</div></div>`)}
    <div class="section-title">Haberes</div>${rubroList(hab)}
    ${mul.length ? html`<div class="section-title">Sanciones</div>${rubroList(mul)}` : ''}
    ${r.deducciones.length ? html`<div class="section-title">Descuentos de ley</div>
      <ul class="rubro-list">${r.deducciones.map((d) => html`<li class="neg"><span class="l">${d.label}<small>${percent(d.pct)} s/ ${money(d.base)}</small></span><span class="v">− ${money(d.amount)}</span></li>`)}</ul>` : ''}
    <div class="section-title">Base legal</div>
    <div class="chips">${r.refs.map((x) => html`<span class="badge">${x}</span>`)}</div>`;
}

export default {
  id: 'simulador', title: 'Liquidación final', icon: 'fa-calculator', group: 'Principal',

  async mount(el, ctx, params) {
    const emps = await ctx.services.employees.list();
    let result = null, savedId = null;

    el.innerHTML = html`
      <div class="page-head"><div><h2>Simulador de liquidación final</h2><p>El cálculo se actualiza mientras completás los datos.</p></div>
        <div class="page-actions"><button class="btn btn-ghost" data-action="reset"><i class="fas fa-eraser"></i> Limpiar</button></div></div>
      <div class="sim-layout">
        <div class="card"><div class="card-body">${formHTML(emps)}</div></div>
        <div class="card sim-result">
          <div class="card-body" id="sim-out"></div>
          <div class="card-footer sim-actions" id="sim-actions" hidden>
            <button class="btn btn-primary btn-sm" data-action="save"><i class="fas fa-floppy-disk"></i> Guardar liquidación</button>
            <button class="btn btn-outline btn-sm" data-action="pdf"><i class="fas fa-file-pdf"></i> Descargar PDF</button>
            <button class="btn btn-share btn-sm" data-action="share"><i class="fas fa-share-nodes"></i> Compartir</button>
            <a class="btn btn-outline btn-sm" id="btn-receipt" hidden><i class="fas fa-file-lines"></i> Ver recibo</a>
          </div>
        </div>
      </div>`;

    const form = $('#sim-form', el);
    const out = $('#sim-out', el);
    const actions = $('#sim-actions', el);
    const placeholder = () => { out.innerHTML = html`<div class="empty"><i class="fas fa-calculator"></i><h4>Completá los datos</h4><p>Ingresá fechas y remuneración para ver el resultado.</p></div>`; actions.hidden = true; };
    placeholder();

    const meta = () => {
      const d = readForm(form);
      const emp = emps.find((e) => e.id === d.employeeId);
      return {
        employeeId: emp?.id, employeeName: emp?.nombre || d.nombre, employeeDni: emp?.dni, employeeCuil: emp?.cuil, employeeLegajo: emp?.legajo,
        convenio: emp?.convenio, categoria: emp?.categoria, notas: d.notas,
        pago: { fecha: d.fechaPago || '', lugar: (d.lugarPago || '').trim() || ctx.state.settings.estudio.lugarPago || '', forma: d.formaPago || '' },
        deposito: { periodo: (d.depPeriodo || '').trim(), fecha: d.depFecha || '', banco: (d.depBanco || '').trim() },
      };
    };

    function syncUI(d) {
      $('#acuerdo-field', el).hidden = d.motivo !== 'mutuo_acuerdo';
      const aplica = ['despido_sin_causa', 'despido_indirecto'].includes(d.motivo);
      $('#preaviso-check', el).hidden = !aplica;
      const historico = isValidISO(d.fechaEgreso) && d.fechaEgreso < FECHAS_LEGALES.leyBases;
      $$('#multas-box .check', el).forEach((c) => { c.classList.toggle('disabled', !historico); c.querySelector('input').disabled = !historico; if (!historico) c.querySelector('input').checked = false; });
      $('#multas-hint', el).textContent = historico ? 'Casos anteriores a la Ley Bases (09/07/2024).' : 'Multas derogadas por Ley 27.742 para egresos posteriores al 09/07/2024. Cargá un egreso anterior para calcular casos históricos.';
      const box = $('#antig', el);
      if (isValidISO(d.fechaIngreso) && isValidISO(d.fechaEgreso) && d.fechaEgreso >= d.fechaIngreso) {
        const a = calcAntiguedad(d.fechaIngreso, d.fechaEgreso);
        const m = resolverMarcoLegal(d.fechaEgreso, ctx.state.settings);
        box.hidden = false;
        box.innerHTML = `<i class="fas fa-hourglass-half"></i> Antigüedad: ${a.texto} · ${a.periodos} período(s) · Período de prueba aplicable: ${m.periodoPruebaMeses} meses`;
      } else box.hidden = true;
    }

    const recalc = () => {
      const d = readForm(form);
      syncUI(d);
      $$('[data-error]', form).forEach((s) => { s.textContent = ''; s.closest('.field').classList.remove('has-error'); });
      savedId = null; $('#btn-receipt', el).hidden = true;
      const filled = d.fechaIngreso && d.fechaEgreso && d.sueldo;
      if (!filled) return placeholder();
      try {
        result = liquidar(d, ctx.state.settings);
        out.innerHTML = resultHTML(result);
        actions.hidden = false;
      } catch (err) {
        if (!(err instanceof ValidationError)) { console.error(err); return placeholder(); }
        placeholder();
        for (const [k, msg] of Object.entries(err.errors)) {
          const s = form.querySelector(`[data-error="${k}"]`);
          if (s) { s.textContent = msg; s.closest('.field').classList.add('has-error'); }
        }
      }
    };
    const recalcSoon = debounce(recalc, 120);
    form.addEventListener('input', recalcSoon);
    form.addEventListener('change', (e) => {
      if (e.target.name === 'employeeId') {
        const emp = emps.find((x) => x.id === e.target.value);
        if (emp) fillForm(form, { nombre: emp.nombre, fechaIngreso: emp.fechaIngreso, fechaEgreso: emp.fechaEgreso || '', sueldo: emp.sueldo });
      }
      recalc();
    });

    on(el, 'click', '[data-action="reset"]', () => { form.reset(); result = null; recalc(); });

    on(el, 'click', '[data-action="save"]', async (_, btn) => {
      if (!result) return;
      const m = meta();
      if (!m.employeeName) return ctx.toast('Ingresá el nombre del trabajador para guardar.', 'warning');
      btn.setAttribute('aria-busy', 'true');
      try {
        const saved = await ctx.services.liquidations.save(result, m);
        savedId = saved.id;
        const link = $('#btn-receipt', el); link.hidden = false; link.href = `#/recibos?id=${saved.id}`;
        ctx.toast('Liquidación guardada', 'success');
      } catch (e) { console.error(e); ctx.toast('No se pudo guardar la liquidación.', 'error'); }
      finally { btn.removeAttribute('aria-busy'); }
    });

    on(el, 'click', '[data-action="share"]', () => {
      if (!result) return;
      const m = meta();
      if (!m.employeeName) return ctx.toast('Ingresá el nombre del trabajador para compartir.', 'warning');
      shareLiquidacion(ctx, { ...toRecord(result, m), createdAt: new Date().toISOString() });
    });

    on(el, 'click', '[data-action="pdf"]', async (_, btn) => {
      if (!result) return;
      btn.setAttribute('aria-busy', 'true');
      try { await exportReceiptPDF({ ...toRecord(result, meta()), createdAt: new Date().toISOString() }, ctx); }
      catch { ctx.toast('No se pudo generar el PDF. Revisá tu conexión.', 'error'); }
      finally { btn.removeAttribute('aria-busy'); }
    });

    // Preselección desde Empleados (?emp=ID)
    const pre = params.get('emp');
    if (pre && emps.some((e) => e.id === pre)) {
      form.elements.employeeId.value = pre;
      form.elements.employeeId.dispatchEvent(new Event('change', { bubbles: true }));
    } else syncUI(readForm(form));
  },
};
