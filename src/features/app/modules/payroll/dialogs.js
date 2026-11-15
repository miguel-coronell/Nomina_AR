import { html } from '../../../../core/html.js';
import { $, readForm, num } from '../../../../core/dom.js';
import { money, MESES, todayISO } from '../../../../core/format.js';
import { TIPOS_NOMINA, describirPeriodo } from '../../../../domain/payroll/periodos.js';
import { calcularLinea } from '../../../../domain/payroll/engine.js';
import { periodoDeRun } from '../../../../domain/payroll/run.js';
import { printHTML } from '../../../../services/print.service.js';
import { downloadPayslipsPDF } from '../../../../services/pdf/index.js';
import { payslipHTML } from './payslip.view.js';
import { sharePayslip } from '../../shared/share.dialog.js';

const footerBtns = (...btns) => {
  const f = document.createElement('div');
  f.className = 'modal-actions';
  f.innerHTML = btns.join('');
  return f;
};
const busy = (b, on) => (on ? b.setAttribute('aria-busy', 'true') : b.removeAttribute('aria-busy'));

/* ---------- Nueva nómina ---------- */
export function newRunDialog(ctx, employees, onCreate) {
  const now = new Date();
  const body = document.createElement('div');
  body.innerHTML = html`
    <form id="nr" class="form-grid" novalidate>
      <div class="field full"><label>Tipo de nómina</label>
        <select class="select" name="tipo">${TIPOS_NOMINA.map((t) => html`<option value="${t.id}">${t.label}</option>`)}</select></div>
      <div class="field"><label>Año</label><input class="input" type="number" name="year" min="2000" max="2100" value="${now.getFullYear()}"></div>
      <div class="field" data-for="mensual quincenal"><label>Mes</label>
        <select class="select" name="month">${MESES.map((m, i) => html`<option value="${i + 1}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`)}</select></div>
      <div class="field" data-for="quincenal"><label>Quincena</label>
        <select class="select" name="quincena"><option value="1">1.ª (1 al 15)</option><option value="2" ${now.getDate() > 15 ? 'selected' : ''}>2.ª (16 a fin de mes)</option></select></div>
      <div class="field" data-for="sac"><label>Semestre</label>
        <select class="select" name="semestre"><option value="1" ${now.getMonth() < 6 ? 'selected' : ''}>1.er semestre (vence 30/06)</option><option value="2" ${now.getMonth() >= 6 ? 'selected' : ''}>2.º semestre (vence 18/12)</option></select></div>
      <div class="field"><label>Fecha de pago prevista</label><input class="input" type="date" name="fechaPago"></div>
      <div class="field full"><label>Notas internas</label><input class="input" name="notas" maxlength="200"></div>
      <label class="check full" data-for="mensual quincenal"><input type="checkbox" name="todos"><span>Incluir a todos los empleados activos, sin importar su periodicidad de pago<small>Útil, por ejemplo, para pagar a empleados "mensuales" dentro de una quincena.</small></span></label>
      <div class="full alert alert-info" id="nr-info"></div>
    </form>`;
  const form = $('#nr', body);
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-plus"></i> Crear nómina</button>');
  const m = ctx.openModal({ title: 'Nueva nómina', body, footer });
  const create = footer.querySelector('[data-s]');

  const cfg = () => { const d = readForm(form); return { ...d, year: num(d.year), month: num(d.month), quincena: num(d.quincena), semestre: num(d.semestre) }; };
  const refresh = () => {
    const c = cfg();
    form.querySelectorAll('[data-for]').forEach((f) => { f.hidden = !f.dataset.for.split(' ').includes(c.tipo); });
    const list = ctx.services.payroll.candidatos(c, employees);
    const p = describirPeriodo(c);
    const info = $('#nr-info', body);
    const hint = c.tipo === 'sac' ? '' : ` con periodicidad ${c.tipo}`;
    info.className = `full alert ${list.length ? 'alert-info' : 'alert-warning'}`;
    info.innerHTML = list.length
      ? `<i class="fas fa-users"></i><div><strong>${p.label}</strong><br>Se incluirán <b>${list.length}</b> empleado(s)${c.todos ? '' : hint}. Podrás cargar novedades antes de liquidar.</div>`
      : `<i class="fas fa-triangle-exclamation"></i><div>No hay empleados con periodicidad <b>${c.tipo}</b> activos en <strong>${p.label}</strong>. Tildá <b>"Incluir a todos los empleados activos"</b>, cambiá la periodicidad en cada ficha, o importá empleados.</div>`;
    create.disabled = !list.length;
  };
  form.addEventListener('input', refresh);
  refresh();

  footer.querySelector('[data-c]').onclick = m.close;
  create.onclick = async () => {
    busy(create, true);
    const opciones = async () => {
      const c = cfg(), p = describirPeriodo(c);
      return {};
    };
    try { const run = await ctx.services.payroll.create(cfg(), employees, ctx.state.settings, await opciones()); m.close(); onCreate(run); }
    catch (e) {
      if (e.code === 'DUPLICATE') {
        const otra = await ctx.confirmDialog({ title: 'Ya existe esa nómina', message: `Ya hay una nómina de ${e.label}. ¿Querés crear una complementaria (por ajustes o pagos adicionales)? Si cancelás, se abre la existente.`, confirmText: 'Crear complementaria' });
        try {
          const run = otra ? await ctx.services.payroll.create(cfg(), employees, ctx.state.settings, { ...(await opciones()), complementaria: true }) : { id: e.existingId };
          m.close(); onCreate(run);
        } catch (e2) { console.error(e2); ctx.toast('No se pudo crear la nómina complementaria.', 'error'); }
      } else { console.error(e); ctx.toast(e.code === 'EMPTY' ? e.message : 'No se pudo crear la nómina. Intentá de nuevo.', 'error'); }
    } finally { busy(create, false); }
  };
}

/* ---------- Novedades de un empleado ---------- */
export function novedadesDialog(ctx, run, line, onSave) {
  const sac = run.tipo === 'sac';
  const pas = line.snap.regimen === 'pasantia';
  const locked = run.estado !== 'borrador';
  const nv = line.novedades;
    const f = (name, label, step = '1', hint = '') => html`<div class="field"><label>${label}</label><input class="input" type="number" min="0" step="${step}" name="${name}" value="${nv[name] || ''}" placeholder="0" ${locked ? 'disabled' : ''}>${hint ? html`<span class="hint">${hint}</span>` : ''}</div>`;
  const body = document.createElement('div');
  body.innerHTML = html`
    ${pas ? html`<div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-graduation-cap"></i><div>Pasantía educativa: la asignación estímulo es no remunerativa y no admite horas extras. Solo podés cargar adelantos u otros descuentos.</div></div>` : ''}
    <form id="nv" class="form-grid" novalidate>
      ${pas ? '' : sac ? f('mejorRemuneracion', 'Mejor remuneración del semestre', '0.01', 'Vacío = se calcula con sueldo, antigüedad y presentismo.') : html`
        ${line.snap.modalidad === 'hora' ? f('hsNormales', 'Horas normales trabajadas', '0.5', `Se multiplican por el valor hora (${money(line.snap.valorHora)}).`) : ''}
        ${f('he50', 'Horas extras al 50%')}${f('he100', 'Horas extras al 100%')}
        ${f('feriadosTrabajados', 'Feriados trabajados (días)', '1', 'Se paga un día adicional por cada feriado trabajado (art. 166).')}
        ${f('ausenciasInjustificadas', 'Ausencias injustificadas (días)', '0.5', 'Descuenta el día y hace perder el presentismo.')}
        ${f('sinGoce', 'Licencia sin goce de haberes (días)', '0.5')}
        ${f('hsDescontar', 'Horas a descontar (tardanzas / salidas anticipadas)', '0.5')}
        ${f('bono', 'Adicional / bono remunerativo', '0.01')}
        ${f('noRemunerativo', 'Adicional no remunerativo', '0.01')}`}
      ${f('adelanto', 'Adelanto / anticipo a descontar', '0.01')}
      ${f('otrosDescuentos', 'Otros descuentos', '0.01')}
      <div class="field full"><label>Observación (se imprime en el recibo)</label><input class="input" name="nota" maxlength="200" value="${nv.nota || ''}" ${locked ? 'disabled' : ''}></div>
      <div class="full" id="nv-prev"></div>
    </form>`;
  const form = $('#nv', body);
  const preview = () => {
    const d = readForm(form);
    const calc = calcularLinea(line.snap, d, periodoDeRun(run), run.params);
    $('#nv-prev', body).innerHTML = html`
      <div class="big-total"><small>Neto estimado</small><strong>${money(calc.totals.neto)}</strong>
        <div class="sub"><span>Bruto: <b>${money(calc.totals.bruto)}</b></span><span>Descuentos: <b>${money(calc.totals.descuentos)}</b></span></div></div>
      ${calc.warnings.map((w) => html`<div class="alert alert-warning" style="margin-top:.6rem"><i class="fas fa-triangle-exclamation"></i><div>${w}</div></div>`)}`;
    return d;
  };
  form.addEventListener('input', preview); preview();
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>' + (locked ? 'Cerrar' : 'Cancelar') + '</button>', locked ? '' : '<button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>');
  const m = ctx.openModal({ title: `Novedades — ${line.nombre}`, body, footer });
  footer.querySelector('[data-c]').onclick = m.close;
  const save = footer.querySelector('[data-s]');
  if (save) save.onclick = async () => {
    busy(save, true);
    try { const next = await ctx.services.payroll.saveNovedades(run, line.employeeId, readForm(form)); m.close(); onSave(next); ctx.toast('Novedades guardadas', 'success'); }
    catch (e) { ctx.toast(e.code === 'LOCKED' ? e.message : 'No se pudo guardar.', 'error'); }
    finally { busy(save, false); }
  };
}

/* ---------- Datos del recibo: lugar de pago y depósito de aportes (art. 140 LCT / art. 12 Dto.-ley 17.250/67) ---------- */
export function metaDialog(ctx, run, onSave) {
  const dep = run.deposito || {};
  const body = document.createElement('div');
  body.innerHTML = html`
    <div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-scale-balanced"></i><div>El recibo debe indicar el <strong>lugar y fecha de pago</strong> y, según el art. 12 del Dto.-ley 17.250/67, el <strong>último depósito de aportes y contribuciones</strong> (período, fecha y banco).</div></div>
    <form id="mt" class="form-grid">
      <div class="field"><label>Fecha de pago</label><input class="input" type="date" name="fechaPago" value="${run.fechaPago || ''}"></div>
      <div class="field"><label>Lugar de pago</label><input class="input" name="lugarPago" value="${run.lugarPago || ctx.state.settings.estudio.lugarPago || ''}" placeholder="Ej: Mendoza, Capital"></div>
      <div class="fieldset-title">Último depósito de aportes y contribuciones</div>
      <div class="field"><label>Período depositado</label><input class="input" name="depPeriodo" value="${dep.periodo || ''}" placeholder="MM/AAAA"></div>
      <div class="field"><label>Fecha del depósito</label><input class="input" type="date" name="depFecha" value="${dep.fecha || ''}"></div>
      <div class="field full"><label>Banco</label><input class="input" name="depBanco" value="${dep.banco || ''}" placeholder="Ej: Banco Nación"></div>
    </form>`;
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>');
  const m = ctx.openModal({ title: 'Datos del recibo', body, footer });
  footer.querySelector('[data-c]').onclick = m.close;
  const ok = footer.querySelector('[data-s]');
  ok.onclick = async () => {
    const d = readForm($('#mt', body));
    busy(ok, true);
    try {
      const next = await ctx.services.payroll.setMeta(run, { fechaPago: d.fechaPago, lugarPago: d.lugarPago.trim(), deposito: { periodo: d.depPeriodo.trim(), fecha: d.depFecha, banco: d.depBanco.trim() } });
      m.close(); onSave(next); ctx.toast('Datos del recibo guardados', 'success');
    } catch { ctx.toast('No se pudo guardar.', 'error'); } finally { busy(ok, false); }
  };
}

/* ---------- Registrar pago ---------- */
export function pagoDialog(ctx, run, ids, onDone) {
  const lines = run.lines.filter((l) => ids.includes(l.employeeId));
  const total = lines.reduce((a, l) => a + l.totals.neto, 0);
  const body = document.createElement('div');
  body.innerHTML = html`
    <p class="muted-text" style="margin-bottom:1rem"><strong>${lines.length}</strong> empleado(s) · total <strong>${money(total)}</strong></p>
    <form id="pg" class="form-grid">
      <div class="field"><label>Fecha de pago</label><input class="input" type="date" name="fecha" value="${todayISO()}"></div>
      <div class="field"><label>Medio de pago</label>
        <select class="select" name="medio"><option value="transferencia">Transferencia bancaria</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="otro">Otro</option></select></div>
      <div class="full" id="pg-warn"></div>
    </form>`;
  const form = $('#pg', body);
  const sinCbu = lines.filter((l) => !l.cbu);
  const warn = () => {
    $('#pg-warn', body).innerHTML = readForm(form).medio === 'transferencia' && sinCbu.length
      ? html`<div class="alert alert-warning"><i class="fas fa-triangle-exclamation"></i><div>${sinCbu.length} empleado(s) sin CBU cargado: ${sinCbu.slice(0, 4).map((l) => l.nombre).join(', ')}${sinCbu.length > 4 ? '…' : ''}.</div></div>` : '';
  };
  form.addEventListener('change', warn); warn();
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-check"></i> Confirmar pago</button>');
  const m = ctx.openModal({ title: 'Registrar pago de nómina', body, footer, size: 'sm' });
  footer.querySelector('[data-c]').onclick = m.close;
  const ok = footer.querySelector('[data-s]');
  ok.onclick = async () => {
    const d = readForm(form);
    if (!d.fecha) return ctx.toast('Indicá la fecha de pago.', 'warning');
    busy(ok, true);
    try { const next = await ctx.services.payroll.registrarPago(run, ids, d); m.close(); onDone(next); ctx.toast('Pago registrado', 'success'); }
    catch { ctx.toast('No se pudo registrar el pago.', 'error'); } finally { busy(ok, false); }
  };
}

/* ---------- Recibo de haberes ---------- */
export function payslipDialog(ctx, run, line) {
  const est = ctx.state.settings.estudio;
  const body = document.createElement('div');
  body.className = 'receipt-scroll';
  body.innerHTML = payslipHTML(run, line, est, ctx.user.name);
  const footer = footerBtns('<button type="button" class="btn btn-outline" data-p><i class="fas fa-print"></i> Imprimir</button>', ...(run.estado !== 'borrador' ? ['<button type="button" class="btn btn-share" data-s><i class="fas fa-share-nodes"></i> Compartir</button>'] : []), '<button type="button" class="btn btn-primary" data-d><i class="fas fa-file-pdf"></i> Descargar PDF</button>');
  const m = ctx.openModal({ title: `Recibo — ${line.nombre}`, body, footer, size: 'lg' });
  const sh = footer.querySelector('[data-s]');
  if (sh) sh.onclick = () => { m.close(); sharePayslip(ctx, run, line); };
  footer.querySelector('[data-p]').onclick = () => printHTML(payslipHTML(run, line, est, ctx.user.name));
  const d = footer.querySelector('[data-d]');
  d.onclick = async () => {
    busy(d, true);
    try { await downloadPayslipsPDF(run, [line], est, ctx.user.name); }
    catch { ctx.toast('No se pudo generar el PDF. Revisá tu conexión.', 'error'); } finally { busy(d, false); }
  };
}

export const printAllPayslips = (ctx, run) =>
  printHTML(run.lines.map((l) => payslipHTML(run, l, ctx.state.settings.estudio, ctx.user.name)).join(''));
