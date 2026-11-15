import { html } from '../../../../core/html.js';
import { $, readForm } from '../../../../core/dom.js';
import { addDays, parseISO, toISO, toUTC } from '../../../../core/dates.js';
import { dateAR } from '../../../../core/format.js';
import { feriadosDelAnio, TIPOS_FERIADO } from '../../../../domain/hr/feriados.js';
import { LICENCIAS, TIPOS_DIA } from '../../../../domain/hr/licencias.js';
import { horasPactadas } from '../../../../domain/hr/horario.js';

const actions = (...b) => { const f = document.createElement('div'); f.className = 'modal-actions'; f.innerHTML = b.join(''); return f; };
const busy = (b, on) => (on ? b.setAttribute('aria-busy', 'true') : b.removeAttribute('aria-busy'));

/* ---------- Calendario de feriados ---------- */
export function feriadosDialog(ctx, year, onChange) {
  const body = document.createElement('div');
  let y = year;
  const aj = () => ctx.state.settings.feriados || { custom: [], removidos: [] };

  const draw = () => {
    const mapa = [...feriadosDelAnio(y, aj()).entries()].sort(([a], [b]) => a.localeCompare(b));
    body.innerHTML = html`
      <div style="display:flex;gap:.6rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
        <button class="icon-btn" data-y="-1" aria-label="Año anterior"><i class="fas fa-angle-left"></i></button><strong style="font-size:1.1rem">${y}</strong>
        <button class="icon-btn" data-y="1" aria-label="Año siguiente"><i class="fas fa-angle-right"></i></button>
        <span class="muted-text" style="font-size:.82rem">${y === 2026 ? 'Calendario nacional 2026 (Ley 27.399 y Dto. 614/2025).' : 'Solo se precargan los feriados de fecha fija: agregá los demás.'}</span>
      </div>
      <div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-circle-info"></i><div><b>Feriado:</b> si se trabaja se paga doble (art. 166 LCT). <b>Día no laborable:</b> es optativo para el empleador; si se trabaja se paga como un día común. Agregá aquí los feriados provinciales, municipales o del gremio.</div></div>
      <div class="table-wrap" style="max-height:300px;overflow:auto"><table class="table"><thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th></th></tr></thead>
        <tbody>${mapa.map(([f, v]) => html`<tr><td>${dateAR(f)}</td><td>${v.nombre}${v.custom ? html` <span class="badge">Agregado</span>` : ''}</td>
          <td><span class="badge ${v.tipo === 'feriado' ? 'badge-danger' : 'badge-warning'}">${TIPOS_FERIADO[v.tipo]}</span></td>
          <td class="actions"><button class="icon-btn" data-rm="${f}" title="Quitar"><i class="fas fa-trash"></i></button></td></tr>`)}</tbody></table></div>
      <form id="fr" class="form-grid" style="margin-top:1rem">
        <div class="fieldset-title">Agregar feriado o día no laborable</div>
        <div class="field"><label>Fecha</label><input class="input" type="date" name="fecha" min="${y}-01-01" max="${y}-12-31"></div>
        <div class="field"><label>Tipo</label><select class="select" name="tipo"><option value="feriado">Feriado</option><option value="no_laborable">Día no laborable</option></select></div>
        <div class="field full"><label>Descripción</label><input class="input" name="nombre" placeholder="Ej: Día de la Vendimia, feriado provincial…"></div>
        <div class="full"><button type="button" class="btn btn-outline btn-sm" data-add><i class="fas fa-plus"></i> Agregar</button></div>
      </form>`;
  };
  const save = async (next) => { await ctx.updateSettings({ ...ctx.state.settings, feriados: next }); onChange?.(); draw(); };

  body.addEventListener('click', async (e) => {
    const yy = e.target.closest('[data-y]'); if (yy) { y += Number(yy.dataset.y); draw(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) {
      const f = rm.dataset.rm, a = aj();
      const esCustom = a.custom.some((c) => c.fecha === f);
      await save({ custom: a.custom.filter((c) => c.fecha !== f), removidos: esCustom ? a.removidos : [...new Set([...a.removidos, f])] });
    }
    if (e.target.closest('[data-add]')) {
      const d = readForm($('#fr', body));
      if (!d.fecha || !d.nombre.trim()) return ctx.toast('Completá la fecha y la descripción.', 'warning');
      const a = aj();
      await save({ custom: [...a.custom.filter((c) => c.fecha !== d.fecha), { fecha: d.fecha, nombre: d.nombre.trim(), tipo: d.tipo }], removidos: a.removidos.filter((r) => r !== d.fecha) });
      ctx.toast('Agregado al calendario', 'success');
    }
  });
  draw();
  const footer = actions('<button type="button" class="btn btn-primary" data-c>Listo</button>');
  const m = ctx.openModal({ title: 'Calendario de feriados', body, footer, size: 'lg' });
  footer.querySelector('[data-c]').onclick = m.close;
}

/* ---------- Registrar licencia / ausencia en un rango ---------- */
export function licenciaDialog(ctx, emp, desdeDefault, feriados, onApply) {
  const body = document.createElement('div');
  body.innerHTML = html`
    <form id="lc" class="form-grid">
      <div class="field full"><label>Tipo</label>
        <select class="select" name="t">
          <option value="L">Licencia con goce / vacaciones</option>
          <option value="FJ">Falta justificada (con goce)</option>
          <option value="FI">Falta injustificada</option>
          <option value="SG">Licencia sin goce de haberes</option>
          <option value="NL">Día no laborable otorgado (con goce)</option>
        </select></div>
      <div class="field full" id="lc-l"><label>Licencia</label><select class="select" name="l">${LICENCIAS.map((l) => html`<option value="${l.id}">${l.label}</option>`)}</select><span class="hint" id="lc-ref"></span></div>
      <div class="field"><label>Desde</label><input class="input" type="date" name="desde" value="${desdeDefault}"></div>
      <div class="field"><label>Hasta</label><input class="input" type="date" name="hasta" value="${desdeDefault}"></div>
      <label class="check full"><input type="checkbox" name="corridos" checked><span>Contar días corridos (incluye sábados, domingos y feriados)<small>Vacaciones y la mayoría de las licencias se cuentan en días corridos. Desmarcá para registrar solo los días de trabajo.</small></span></label>
      <div class="field full"><label>Nota</label><input class="input" name="n" maxlength="120" placeholder="Ej: certificado médico N.º…"></div>
      <div class="full" id="lc-info"></div>
    </form>`;
  const form = $('#lc', body);
  const fechas = () => {
    const d = readForm(form);
    if (!d.desde || !d.hasta || d.hasta < d.desde) return [];
    const out = []; let p = parseISO(d.desde); const fin = toUTC(parseISO(d.hasta));
    while (toUTC(p) <= fin && out.length < 400) {
      const iso = toISO(p);
      const habil = horasPactadas(emp.horario, iso) > 0 && feriados.get(iso)?.tipo !== 'feriado';
      if (d.corridos || habil) out.push(iso);
      p = addDays(p, 1);
    }
    return out.filter((f) => f >= emp.fechaIngreso && (!emp.fechaEgreso || f <= emp.fechaEgreso));
  };
  const refresh = () => {
    const d = readForm(form);
    $('#lc-l', body).hidden = d.t !== 'L';
    $('#lc-ref', body).textContent = LICENCIAS.find((l) => l.id === d.l)?.ref || '';
    const n = fechas().length;
    $('#lc-info', body).innerHTML = html`<div class="alert alert-info"><i class="fas fa-calendar-days"></i><div>Se registrarán <b>${n}</b> día(s) como <b>${d.t === 'L' ? LICENCIAS.find((l) => l.id === d.l)?.label : TIPOS_DIA[d.t].label}</b>.</div></div>`;
  };
  form.addEventListener('input', refresh); form.addEventListener('change', refresh); refresh();
  const footer = actions('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-check"></i> Registrar</button>');
  const m = ctx.openModal({ title: `Licencia o ausencia — ${emp.nombre}`, body, footer });
  footer.querySelector('[data-c]').onclick = m.close;
  const ok = footer.querySelector('[data-s]');
  ok.onclick = async () => {
    const d = readForm(form), dias = fechas();
    if (!dias.length) return ctx.toast('No hay días para registrar en ese rango.', 'warning');
    busy(ok, true);
    try { await onApply(dias, { t: d.t, ...(d.t === 'L' ? { l: d.l } : {}), ...(d.n ? { n: d.n } : {}) }); m.close(); }
    catch (e) { console.error(e); ctx.toast('No se pudo registrar.', 'error'); } finally { busy(ok, false); }
  };
}
