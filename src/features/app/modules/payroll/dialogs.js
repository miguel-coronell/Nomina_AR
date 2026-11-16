import { html } from '../../../../core/html.js';
import { $, readForm, num } from '../../../../core/dom.js';
import { money, dateAR, MESES, todayISO } from '../../../../core/format.js';
import { vigenciasDisponibles } from '../../../../domain/convenios/escalas.js';
import { TIPOS_NOMINA, describirPeriodo } from '../../../../domain/payroll/periodos.js';
import { calcularLinea } from '../../../../domain/payroll/engine.js';
import { jornadaPeriodo } from '../../../../domain/payroll/jornada.js';
import { periodoDeRun } from '../../../../domain/payroll/run.js';
import { printHTML } from '../../../../services/print.service.js';
import { downloadPayslipsPDF } from '../../../../services/pdf/index.js';
import { payslipHTML } from './payslip.view.js';
import { getFirmas, setFirma, fmtFirma } from '../../../../services/firmas.service.js';
import { signaturePad } from '../../shared/signature-pad.js';
import { FORMATOS_RECIBO, formatoRecibo } from '../../../../domain/payroll/clasico.js';
import { sharePayslip } from '../../shared/share.dialog.js';

const footerBtns = (...btns) => {
  const f = document.createElement('div');
  f.className = 'modal-actions';
  f.innerHTML = btns.join('');
  return f;
};
const busy = (b, on) => (on ? b.setAttribute('aria-busy', 'true') : b.removeAttribute('aria-busy'));

/** Opciones del selector de vigencia de la escala de valor hora. */
const opcionesVigencia = (sel = '') => html`<option value="">Automática: la vigente al inicio del período</option>${vigenciasDisponibles().map((d) => html`<option value="${d}" ${d === sel ? 'selected' : ''}>Escala vigente desde ${dateAR(d)}</option>`)}`;
const AYUDA_VIGENCIA = html`<span class="hint">Solo afecta al personal jornalizado con valor hora de la escala. ¿Salió un aumento nuevo? <a href="#/escalas" data-close>Cargalo en Escalas y vigencias</a> y después elegilo acá.</span>`;

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
      <div class="field full"><label>Escala de valor hora</label><select class="select" name="vigencia">${opcionesVigencia()}</select>${AYUDA_VIGENCIA}</div>
      <div class="field full"><label>Notas internas</label><input class="input" name="notas" maxlength="200"></div>
      <label class="check full" data-for="mensual quincenal"><input type="checkbox" name="todos"><span>Incluir a todos los empleados activos, sin importar su periodicidad de pago<small>Útil, por ejemplo, para pagar a empleados "mensuales" dentro de una quincena.</small></span></label>
      <div class="full alert alert-info" id="nr-info"></div>
    </form>`;
  const form = $('#nr', body);
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-plus"></i> Crear nómina</button>');
  const m = ctx.openModal({ title: 'Nueva nómina', body, footer });
  const create = footer.querySelector('[data-s]');
  body.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) m.close(); });

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

/* ---------- Escala (vigencia) de una nómina en borrador ---------- */
export function vigenciaDialog(ctx, run, onApply) {
  const body = document.createElement('div');
  body.innerHTML = html`
    <div class="field"><label>Escala de valor hora para ${run.label}</label>
      <select class="select" name="vigencia">${opcionesVigencia(run.vigencia || '')}</select>${AYUDA_VIGENCIA}</div>
    <p class="muted-text" style="font-size:.84rem;margin-top:.7rem">Al aplicar, se recalculan los importes de todos los empleados de la nómina con los valores hora de esa vigencia.</p>`;
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-check"></i> Aplicar</button>');
  const m = ctx.openModal({ title: 'Escala de la nómina', body, footer });
  body.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) m.close(); });
  footer.querySelector('[data-c]').onclick = m.close;
  const ok = footer.querySelector('[data-s]');
  ok.onclick = async () => { busy(ok, true); try { await onApply(body.querySelector('[name=vigencia]').value); m.close(); } finally { busy(ok, false); } };
}

/* ---------- Novedades de un empleado ---------- */
export function novedadesDialog(ctx, run, line, onSave) {
  const sac = run.tipo === 'sac';
  const pas = line.snap.regimen === 'pasantia';
  const locked = run.estado !== 'borrador';
  const nv = line.novedades;
  const jor = jornadaPeriodo(line.snap, periodoDeRun(run), run.params?.feriados);
    const f = (name, label, step = '1', hint = '', ph = '0') => html`<div class="field"><label>${label}</label><input class="input" type="number" min="0" step="${step}" name="${name}" value="${nv[name] || ''}" placeholder="${ph}" ${locked ? 'disabled' : ''}>${hint ? html`<span class="hint">${hint}</span>` : ''}</div>`;
  const body = document.createElement('div');
  body.innerHTML = html`
    ${pas ? html`<div class="alert alert-info" style="margin-bottom:1rem"><i class="fas fa-graduation-cap"></i><div>Pasantía educativa: la asignación estímulo es no remunerativa y no admite horas extras. Solo podés cargar adelantos u otros descuentos.</div></div>` : ''}
    <form id="nv" class="form-grid" novalidate>
      ${pas ? '' : sac ? f('mejorRemuneracion', 'Mejor remuneración del semestre', '0.01', 'Vacío = se calcula con sueldo, antigüedad y presentismo.') : html`
        ${line.snap.modalidad === 'hora' ? f('hsNormales', 'Horas normales trabajadas', '0.5', `Vacío = automático: ${jor.horas} hs (${jor.dias} días hábiles, lunes a viernes sin feriados). Se multiplican por el valor hora (${money(line.snap.valorHora)}).`, `Auto: ${jor.horas}`) : ''}
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
      <div class="field"><label>N° del primer recibo (formato clásico)</label><input class="input" type="number" min="1" name="reciboDesde" value="${run.reciboDesde || ''}" placeholder="Ej: 14"></div>
    </form>`;
  const footer = footerBtns('<button type="button" class="btn btn-ghost" data-c>Cancelar</button>', '<button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>');
  const m = ctx.openModal({ title: 'Datos del recibo', body, footer });
  footer.querySelector('[data-c]').onclick = m.close;
  const ok = footer.querySelector('[data-s]');
  ok.onclick = async () => {
    const d = readForm($('#mt', body));
    busy(ok, true);
    try {
      const next = await ctx.services.payroll.setMeta(run, { fechaPago: d.fechaPago, lugarPago: d.lugarPago.trim(), deposito: { periodo: d.depPeriodo.trim(), fecha: d.depFecha, banco: d.depBanco.trim() }, reciboDesde: d.reciboDesde ? Math.max(1, Math.round(Number(d.reciboDesde))) : '' });
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
  const base = ctx.state.settings.estudio;
  const esPas = line.snap.regimen === 'pasantia';
  let fmt = formatoRecibo(base);
  const est = () => ({ ...base, reciboFormato: fmt });
  const body = document.createElement('div');
  const pick = esPas ? '' : `<div class="field" style="margin-bottom:.8rem"><label>Formato del recibo</label><select class="select" data-fmt>${FORMATOS_RECIBO.map(([k, l]) => `<option value="${k}" ${k === fmt ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  const sw = (p, l) => `<div class="sw-item"><label class="sw"><input type="checkbox" data-firma="${p}"><span class="sw-track"></span><span class="sw-txt"><i class="fas fa-signature"></i> ${l}<small data-fd="${p}"></small></span></label><img class="sw-thumb" data-fthumb="${p}" alt="Firma" hidden><button type="button" class="btn btn-ghost btn-sm" data-refirmar="${p}" hidden><i class="fas fa-pen-nib"></i> Rehacer</button></div>`;
  const firmasBox = `<div class="firma-digital" data-fbox>${sw('empleador', 'Firma del empleador')}${sw('empleado', 'Firma del empleado')}</div>`;
  body.innerHTML = `${pick}${firmasBox}<div class="receipt-scroll" data-view></div>`;
  const view = body.querySelector('[data-view]');
  const paint = () => {
    view.innerHTML = payslipHTML(run, line, est(), ctx.user.name);
    const box = body.querySelector('[data-fbox]');
    if (!box) return;
    const f = getFirmas(run, line);
    box.querySelectorAll('[data-firma]').forEach((i) => { i.checked = !!f[i.dataset.firma]; });
    box.querySelectorAll('[data-fd]').forEach((s) => { s.textContent = f[s.dataset.fd] ? `Firmado ${fmtFirma(f[s.dataset.fd])}` : 'Tocá para firmar'; });
    box.querySelectorAll('[data-fthumb]').forEach((im) => { const v = f[im.dataset.fthumb]; im.hidden = !v?.img; if (v?.img) im.src = v.img; });
    box.querySelectorAll('[data-refirmar]').forEach((b) => { b.hidden = !f[b.dataset.refirmar]; });
  };
  paint();
  const footer = footerBtns('<button type="button" class="btn btn-outline" data-p><i class="fas fa-print"></i> Imprimir</button>', ...(run.estado !== 'borrador' ? ['<button type="button" class="btn btn-share" data-s><i class="fas fa-share-nodes"></i> Compartir</button>'] : []), '<button type="button" class="btn btn-primary" data-d><i class="fas fa-file-pdf"></i> Descargar PDF</button>');
  const m = ctx.openModal({ title: `Recibo — ${line.nombre}`, body, footer, size: 'lg' });
  const nombreDe = { empleador: base.razonSocial || ctx.user.name || 'Empleador', empleado: line.nombre };
  const firmar = async (parte) => {
    const r = await signaturePad(ctx, { titulo: parte === 'empleador' ? 'Firma del empleador' : 'Firma del empleado', nombre: nombreDe[parte] });
    if (r) setFirma(run, line, parte, r);
    paint();
  };
  body.querySelectorAll('[data-firma]').forEach((i) => { i.onchange = () => { if (i.checked) firmar(i.dataset.firma); else { setFirma(run, line, i.dataset.firma, null); paint(); } }; });
  body.querySelectorAll('[data-refirmar]').forEach((b) => { b.onclick = () => firmar(b.dataset.refirmar); });
  const sel = body.querySelector('[data-fmt]');
  if (sel) sel.onchange = () => { fmt = sel.value; paint(); };
  const sh = footer.querySelector('[data-s]');
  if (sh) sh.onclick = () => { m.close(); sharePayslip(ctx, run, line, est()); };
  footer.querySelector('[data-p]').onclick = () => printHTML(payslipHTML(run, line, est(), ctx.user.name), { landscape: fmt === 'clasico' && !esPas });
  const d = footer.querySelector('[data-d]');
  d.onclick = async () => {
    busy(d, true);
    try { await downloadPayslipsPDF(run, [line], est(), ctx.user.name); }
    catch { ctx.toast('No se pudo generar el PDF. Revisá tu conexión.', 'error'); } finally { busy(d, false); }
  };
}

export const printAllPayslips = (ctx, run, estOverride) => {
  const est = estOverride || ctx.state.settings.estudio;
  const clasico = formatoRecibo(est) === 'clasico', hayPas = run.lines.some((l) => l.snap.regimen === 'pasantia');
  if (clasico && hayPas) {   // lote mixto: clásico apaisado + pasantías (recibo propio) verticales
    printHTML(run.lines.map((l) => `<div style="page:${l.snap.regimen === 'pasantia' ? 'completo' : 'clasico'}">${payslipHTML(run, l, est, ctx.user.name)}</div>`).join(''), { mixed: true });
    return;
  }
  printHTML(run.lines.map((l) => payslipHTML(run, l, est, ctx.user.name)).join(''), { landscape: clasico });
};
