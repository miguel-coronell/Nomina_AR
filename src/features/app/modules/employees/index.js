import { html } from '../../../../core/html.js';
import { $, on, readForm, fillForm, debounce } from '../../../../core/dom.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { money, dateAR, initials } from '../../../../core/format.js';
import { downloadXLSX } from '../../../../core/xlsx.js';
import { ZONAS, ESCALAS, valorHoraEscala, vigenciaEscala, categoriasDe, normCat, listaConvenios, convenioId } from '../../../../domain/convenios/escalas.js';
import { CONVENIOS } from '../../../../domain/legal/articles.js';
import { CONTRATOS, JORNADAS, PERIODICIDADES, REGIMENES } from '../../../../services/employees.service.js';
import { TEMPLATE_HEADERS, employeesToRows } from '../../../../services/employee-import.js';
import { importDialog, downloadTemplate } from './import.dialog.js';
import { dcard, emptyCard } from '../../../../core/ui/cards.js';
import { fileToPhoto } from '../../../../core/image.js';

const avatarImg = (e, cls = '') => (e.foto
  ? html`<span class="avatar ${cls} has-img"><img src="${e.foto}" alt=""></span>`
  : html`<span class="avatar ${cls}">${initials(e.nombre)}</span>`);

const isNarrow = () => matchMedia('(max-width: 1100px)').matches;

// Convenios de referencia + los que el usuario creó en «Escalas y vigencias»
const conveniosLista = listaConvenios;
const convenioNombre = (id) => conveniosLista().find((c) => c.id === convenioId(id))?.nombre || id || '—';
const sel = (name, list) => html`<select class="select" name="${name}">${list.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>`;
const ICONOS_CAMPO = { nombre: 'fa-user', dni: 'fa-id-card', cuil: 'fa-fingerprint', fechaNac: 'fa-cake-candles', telefono: 'fa-phone', email: 'fa-envelope', domicilio: 'fa-location-dot',
  legajo: 'fa-hashtag', fechaIngreso: 'fa-calendar-plus', fechaEgreso: 'fa-calendar-xmark', fechaFin: 'fa-calendar-check', sector: 'fa-sitemap', categoria: 'fa-briefcase',
  horasSemanales: 'fa-clock', divisorHora: 'fa-divide', obraSocial: 'fa-heart-pulse', art: 'fa-shield-heart', banco: 'fa-building-columns', cbu: 'fa-credit-card',
  regimen: 'fa-scale-balanced', tipoContrato: 'fa-file-contract', convenio: 'fa-handshake', jornada: 'fa-business-time', modalidad: 'fa-money-check-dollar', sueldo: 'fa-sack-dollar',
  valorHora: 'fa-stopwatch', zona: 'fa-map-location-dot', periodicidad: 'fa-calendar-days', adicionalAntiguedadPct: 'fa-award', presentismoPct: 'fa-user-check',
  institucion: 'fa-school', carrera: 'fa-graduation-cap', convenioMarco: 'fa-file-signature', tutorInst: 'fa-chalkboard-user', tutorEmpresa: 'fa-user-tie', notas: 'fa-note-sticky' };
const fld = (label, name, extra = '', cls = '') => html`<div class="field ${cls}"><label>${ICONOS_CAMPO[name] ? html`<i class="fas ${ICONOS_CAMPO[name]}"></i>` : ''}${label}</label><input class="input" name="${name}" ${raw0(extra)}><span class="error" data-error="${name}"></span></div>`;
function raw0(s) { return html([s]); }

const formHTML = () => html`
  <form id="emp-form" class="form-grid" novalidate>
    <div class="foto-field full">
      <span class="foto-prev" data-foto-prev><i class="fas fa-user"></i></span>
      <div><label>Foto del empleado</label>
        <div class="foto-btns"><button type="button" class="btn btn-outline btn-sm" data-foto-pick><i class="fas fa-camera"></i> Subir foto</button><button type="button" class="btn btn-ghost btn-sm" data-foto-del hidden><i class="fas fa-trash"></i> Quitar</button></div>
        <span class="hint">JPG, PNG o WebP. Se recorta en cuadrado y aparece en la app y en la ficha PDF.</span><span class="error" data-error="foto"></span></div>
      <input type="hidden" name="foto"><input type="file" accept="image/png,image/jpeg,image/webp" hidden data-foto-file>
    </div>
    <div class="fieldset-title">Datos personales</div>
    ${fld('Apellido y nombre *', 'nombre', 'required', 'full')}
    ${fld('DNI', 'dni', 'inputmode="numeric"')}${fld('CUIL', 'cuil', 'inputmode="numeric" placeholder="20-12345678-9"')}
    ${fld('Fecha de nacimiento', 'fechaNac', 'type="date"')}${fld('Teléfono', 'telefono')}
    ${fld('Correo electrónico', 'email', 'type="email"')}${fld('Domicilio', 'domicilio')}

    <div class="fieldset-title">Relación con la empresa</div>
    <div class="field full"><label>Régimen</label>${sel('regimen', REGIMENES)}<span class="hint" data-reg="pasantia">Pasantía educativa (Ley 26.427): sin relación laboral, asignación estímulo no remunerativa, sin vacaciones ni SAC.</span></div>
    ${fld('Legajo', 'legajo')}
    ${fld('Fecha de ingreso / inicio *', 'fechaIngreso', 'type="date"')}${fld('Fecha de egreso', 'fechaEgreso', 'type="date"')}
    ${fld('Fecha de finalización prevista', 'fechaFin', 'type="date"')}
    <div class="field" data-reg="dependencia"><label>Tipo de contrato</label>${sel('tipoContrato', CONTRATOS)}</div>
    <div class="field"><label>Convenio colectivo (referencia)</label><select class="select" name="convenio"><option value="">—</option>${conveniosLista().map((c) => html`<option value="${c.id}">${c.nombre}</option>`)}</select></div>
    ${fld('Sector', 'sector', 'list="sectores-dl" placeholder="Ej: Ventas"')}<datalist id="sectores-dl"></datalist>
    ${fld('Categoría / tarea', 'categoria', 'list="cats-dl" autocomplete="off"')}<datalist id="cats-dl"></datalist>
    <div class="field" data-reg="dependencia"><label>Tipo de jornada</label>${sel('jornada', JORNADAS)}</div>

    <div class="fieldset-title" data-reg="pasantia">Datos de la pasantía</div>
    <div data-reg="pasantia" class="field"><label>Institución educativa</label><input class="input" name="institucion" placeholder="Ej: Universidad Nacional de Cuyo"><span class="error" data-error="institucion"></span></div>
    <div data-reg="pasantia" class="field"><label>Carrera</label><input class="input" name="carrera"></div>
    <div data-reg="pasantia" class="field"><label>Convenio marco / N.º de acuerdo</label><input class="input" name="convenioMarco"></div>
    <div data-reg="pasantia" class="field"><label>Tutor institucional</label><input class="input" name="tutorInst"></div>
    <div data-reg="pasantia" class="field full"><label>Tutor de la empresa</label><input class="input" name="tutorEmpresa"></div>

    <div class="fieldset-title">Jornada</div>
    ${fld('Horas semanales', 'horasSemanales', 'type="number" min="0" max="80" step="0.5" placeholder="Ej: 48 (vacío = 48)"')}
    ${fld('Divisor del valor hora (opcional)', 'divisorHora', 'type="number" step="0.01" min="0" placeholder="Automático: 200 para 48 hs semanales"', 'full')}

    <div class="fieldset-title">Remuneración y nómina</div>
    <div class="field full" data-reg="dependencia"><label>Forma de liquidación</label>${sel('modalidad', [['mensual', 'Mensualizado (sueldo mensual)'], ['hora', 'Jornalizado: se paga por hora trabajada (según escala del convenio)']])}</div>
    <div class="field" data-mod="mensual"><label id="lbl-sueldo">Remuneración mensual bruta *</label><input class="input" type="number" step="0.01" min="0" name="sueldo"><span class="error" data-error="sueldo"></span></div>
    <div class="field" data-mod="hora"><label>Zona (escala del convenio)</label>${sel('zona', ZONAS)}</div>
    <div class="field" data-mod="hora"><label>Valor hora ($) *</label><input class="input" type="number" step="0.01" min="0" name="valorHora"><span class="error" data-error="valorHora"></span><span class="hint" id="vh-hint"></span></div>
    <label class="check" data-mod="hora"><input type="checkbox" name="valorHoraManual"><span>Cargar el valor hora a mano<small>Si no, se toma solo de la escala vigente en cada período.</small></span></label>
    <label class="check" data-mod="hora"><input type="checkbox" name="afiliado"><span>Afiliado al sindicato<small>Aplica la cuota sindical de afiliados.</small></span></label>
    <div class="field" data-reg="dependencia"><label>Periodicidad de pago</label>${sel('periodicidad', PERIODICIDADES)}</div>
    <div data-reg="dependencia" data-mod="mensual" class="field"><label>Antigüedad (% por año)</label><input class="input" type="number" step="0.01" min="0" max="100" name="adicionalAntiguedadPct" placeholder="Ej: 1"><span class="error" data-error="adicionalAntiguedadPct"></span></div>
    <div data-reg="dependencia" class="field"><label>Presentismo (%)</label><input class="input" type="number" step="0.01" min="0" max="100" name="presentismoPct" placeholder="Ej: 8.33 (UOCRA: 20)"><span class="error" data-error="presentismoPct"></span></div>
    <div class="fieldset-title">Cobertura y pago</div>
    ${fld('Obra social', 'obraSocial')}${fld('ART', 'art')}
    ${fld('Banco', 'banco')}${fld('CBU (22 dígitos)', 'cbu', 'inputmode="numeric"')}
    <div class="field full"><label>Notas</label><textarea class="textarea" name="notas" rows="2"></textarea></div>
  </form>`;

const antig = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00'), n = new Date();
  let m = (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() - (n.getDate() < d.getDate() ? 1 : 0);
  m = Math.max(0, m);
  const y = Math.floor(m / 12), r = m % 12;
  return [y ? `${y} ${y === 1 ? 'año' : 'años'}` : '', r ? `${r} ${r === 1 ? 'mes' : 'meses'}` : ''].filter(Boolean).join(' y ') || 'Menos de 1 mes';
};
const edad = (iso) => (iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 31557600000) : null);
const kv = (rows) => html`<div class="kv-grid">${rows.map(([k, v]) => html`<div><span>${k}</span><b>${v || '—'}</b></div>`)}</div>`;
const sectionTitle = (icon, t) => html`<div class="sec-title"><i class="fas ${icon}"></i> ${t}</div>`;

const TIPOS_RUN = { mensual: 'Mensual', quincenal: 'Quincenal', sac: 'SAC' };

/** Genera la ficha en PDF y la abre en una pestaña nueva (lista para imprimir); si el navegador bloquea la ventana, la descarga. */
async function printFicha(ctx, e, runs) {
  const w = window.open('', '_blank');
  if (w) w.document.write('<title>Ficha</title><body style="font:15px system-ui;display:grid;place-items:center;height:90vh;color:#475569">Generando ficha en PDF…</body>');
  try {
    const historial = runs.flatMap((r) => r.lines.filter((l) => l.employeeId === e.id).map((l) => ({
      label: r.label, tipo: TIPOS_RUN[r.tipo] || '', bruto: l.totals.bruto, descuentos: l.totals.descuentos, neto: l.totals.neto,
      pagado: l.pago?.estado === 'pagado', fechaPago: l.pago?.fecha,
    }))).slice(0, 6);
    const emp = { ...e, valorHoraEfectivo: e.modalidad === 'hora' ? valorHoraEscala(e.convenio, e.categoria, e.zona) || e.valorHora : undefined };
    const { fichaPDFFile } = await import('../../../../services/pdf/index.js');
    const { blob, filename } = await fichaPDFFile({ emp, historial, estudio: ctx.state.settings.estudio, userName: ctx.user.name });
    const url = URL.createObjectURL(blob);
    if (w && !w.closed) w.location.href = url;
    else { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (err) {
    console.error(err); w?.close();
    ctx.toast('No se pudo generar la ficha en PDF. Revisá tu conexión.', 'error');
  }
}

export default {
  id: 'empleados', title: 'Empleados', icon: 'fa-users', group: 'Principal',

  async mount(el, ctx, params) {
    let items = await ctx.services.employees.list();
    const runs = await ctx.services.payroll.list();
    const f = { q: '', sector: '' };
    let selId = params.get('emp') || null, tab = 'general', sheetOpen = false;
    let selectMode = false, pageRows = [];
    const picked = new Set();
    const sectores = () => [...new Set(items.map((e) => e.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

    const pager = createPager({ onChange: () => draw() });
    const filtered = () => {
      const match = matcher(f.q);
      return items.filter((e) => match(e.nombre, e.dni, e.cuil, e.legajo, e.categoria, e.sector) && (!f.sector || e.sector === f.sector))
        .sort((a, b) => String(a.legajo || '￿').localeCompare(String(b.legajo || '￿'), 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es'));
    };

    const detail = () => {
      const e = items.find((x) => x.id === selId);
      if (!e) return html`<div class="empty"><i class="fas fa-user"></i><h4>Seleccioná un empleado</h4><p>Hacé clic en una fila para ver su ficha.</p></div>`;
      const hist = runs.flatMap((r) => r.lines.filter((l) => l.employeeId === e.id).map((l) => ({ r, l }))).slice(0, 12);
      const tabs = [['general', 'fa-user', 'Datos generales'], ['laboral', 'fa-briefcase', 'Laborales'], ['cobro', 'fa-building-columns', 'Cobro'], ['historial', 'fa-clock-rotate-left', 'Historial']];
      const body = {
        general: html`${sectionTitle('fa-user', 'Información personal')}${kv([['DNI', e.dni], ['CUIL', e.cuil], ['Fecha de nacimiento', e.fechaNac ? `${dateAR(e.fechaNac)} (${edad(e.fechaNac)} años)` : ''], ['Dirección', e.domicilio], ['Email', e.email], ['Teléfono', e.telefono]])}
          ${sectionTitle('fa-briefcase', 'Información laboral')}${kv([['Sector', e.sector], ['Fecha de ingreso', dateAR(e.fechaIngreso)], ['Categoría', e.categoria], ['Antigüedad', antig(e.fechaIngreso)], ['Convenio', convenioNombre(e.convenio)], ['Régimen', e.regimen === 'pasantia' ? 'Pasantía' : 'Relación de dependencia']])}`,
        laboral: html`${sectionTitle('fa-briefcase', 'Condiciones de trabajo')}${kv([['Contrato', (CONTRATOS.find((c) => c[0] === e.tipoContrato) || [])[1]], ['Jornada', (JORNADAS.find((c) => c[0] === e.jornada) || [])[1]], ['Horas semanales', e.horasSemanales ? `${e.horasSemanales} hs` : '48 hs (por defecto)'], ['Periodicidad', e.periodicidad === 'quincenal' ? 'Quincenal' : 'Mensual'], ['Egreso', e.fechaEgreso ? dateAR(e.fechaEgreso) : '']])}
          ${sectionTitle('fa-sack-dollar', 'Remuneración')}${kv([e.modalidad === 'hora' ? ['Forma de liquidación', 'Por hora (jornal)'] : ['Forma de liquidación', 'Mensualizado'], e.modalidad === 'hora' ? ['Valor hora', money(valorHoraEscala(e.convenio, e.categoria, e.zona) || e.valorHora) + ' /h'] : ['Remuneración bruta', money(e.sueldo)], ['Antigüedad %/año', e.adicionalAntiguedadPct ? e.adicionalAntiguedadPct + '%' : ''], ['Presentismo', e.presentismoPct ? e.presentismoPct + '%' : '']])}
          ${e.notas ? html`${sectionTitle('fa-note-sticky', 'Notas')}<p class="muted-text">${e.notas}</p>` : ''}`,
        cobro: html`${sectionTitle('fa-building-columns', 'Datos de cobro')}${kv([['Banco', e.banco], ['CBU/CVU', e.cbu], ['Obra social', e.obraSocial], ['ART', e.art]])}`,
        historial: hist.length ? html`<table class="table"><thead><tr><th>Período</th><th class="num">Neto</th><th>Pago</th></tr></thead><tbody>${hist.map(({ r, l }) => html`<tr><td><a href="#/nomina?id=${r.id}">${r.label}</a></td><td class="num">${money(l.totals.neto)}</td><td>${l.pago.estado === 'pagado' ? html`<span class="badge badge-success">Pagado</span>` : html`<span class="badge badge-warning">Pendiente</span>`}</td></tr>`)}</tbody></table>`
          : html`<div class="empty"><i class="fas fa-clock-rotate-left"></i><p>Todavía no tiene liquidaciones.</p></div>`,
      }[tab];
      return html`
        <div class="emp-head">${avatarImg(e, 'xl')}
          <div><h3>${e.nombre}</h3><div>${e.fechaEgreso ? html`<span class="badge badge-gray">Egresado</span>` : html`<span class="badge badge-success"><i class="fas fa-circle"></i> Activo</span>`} ${e.regimen === 'pasantia' ? html`<span class="badge">Pasante</span>` : ''}</div><small class="muted-text">Legajo: ${e.legajo || '—'}</small></div>
          <button class="icon-btn sheet-close" data-close-detail aria-label="Cerrar ficha"><i class="fas fa-xmark"></i></button></div>
        <div class="tabs">${tabs.map(([id, ic, l]) => html`<button class="${tab === id ? 'active' : ''}" data-tab="${id}"><i class="fas ${ic}"></i> ${l}</button>`)}</div>
        <div class="emp-body">${body}</div>
        <div class="emp-foot"><button class="btn btn-outline" data-print="${e.id}"><i class="fas fa-print"></i> Imprimir ficha</button><button class="btn btn-primary" data-edit="${e.id}"><i class="fas fa-pen"></i> Editar empleado</button></div>`;
    };

    const draw = () => {
      const list = filtered();
      if (!selId || !items.some((x) => x.id === selId)) selId = list[0]?.id || null;
      const info = pager.apply(list);
      $('#e-pager', el).innerHTML = pager.view(info);
      $('#e-count', el).textContent = `Mostrando ${list.length ? info.rows.length : 0} de ${list.length} empleados`;
      const sel = $('#e-sector', el), cur = f.sector;
      sel.innerHTML = '<option value="">Todos los sectores</option>' + sectores().map((s) => `<option ${s === cur ? 'selected' : ''}>${s.replace(/</g, '&lt;')}</option>`).join('');
      $('#e-cards', el).innerHTML = list.length ? info.rows.map((e) => dcard({
        lead: avatarImg(e), check: selectMode ? html`<input type="checkbox" class="pick" data-pick="${e.id}" ${picked.has(e.id) ? 'checked' : ''} aria-label="Seleccionar">` : '', title: e.nombre, sub: e.legajo ? `Legajo ${e.legajo}` : 'Sin legajo',
        badge: e.fechaEgreso ? html`<span class="badge badge-gray">Egresado</span>` : html`<span class="badge badge-success"><i class="fas fa-circle"></i> Activo</span>`,
        rows: [['fa-id-card', 'DNI', e.dni || '—'], ['fa-sitemap', 'Sector', e.sector || '—'], ['fa-briefcase', 'Categoría', e.categoria || '—', 'wide']],
        cls: `tappable ${e.id === selId && sheetOpen ? 'selected' : ''}`, attrs: `data-row="${e.id}"`,
        actions: html`<button class="btn btn-outline btn-sm" data-edit="${e.id}"><i class="fas fa-pen"></i> Editar</button><button class="icon-btn danger" data-del="${e.id}" title="Eliminar"><i class="fas fa-trash"></i></button>`,
      })).join('') : emptyCard('fa-users', items.length ? 'Sin resultados' : 'Aún no hay empleados', items.length ? 'Probá con otra búsqueda o filtro.' : 'Agregá uno con “Nuevo empleado” o importá tu planilla de Excel.');
      $('#e-body', el).innerHTML = list.length ? info.rows.map((e) => html`
        <tr class="row-sel ${e.id === selId ? 'selected' : ''} ${picked.has(e.id) ? 'picked' : ''}" data-row="${e.id}">
          ${selectMode ? html`<td class="sel-col"><input type="checkbox" class="pick" data-pick="${e.id}" ${picked.has(e.id) ? 'checked' : ''} aria-label="Seleccionar"></td>` : ''}
          <td><strong>${e.legajo || '—'}</strong></td>
          <td><div class="who-cell">${avatarImg(e)}<strong>${e.nombre}</strong></div></td>
          <td>${e.dni || '—'}</td><td>${e.sector || '—'}</td>
          <td>${e.fechaEgreso ? html`<span class="badge badge-gray">Egresado</span>` : html`<span class="badge badge-success"><i class="fas fa-circle"></i> Activo</span>`}</td>
          <td class="actions"><div class="row-actions"><button class="icon-btn pen" data-edit="${e.id}" title="Editar"><i class="fas fa-pen"></i></button><button class="icon-btn" data-del="${e.id}" title="Eliminar"><i class="fas fa-trash"></i></button></div></td>
        </tr>`).join('') : html`<tr><td colspan="7"><div class="empty"><i class="fas fa-users"></i><h4>${items.length ? 'Sin resultados' : 'Aún no hay empleados'}</h4><p>${items.length ? 'Probá con otra búsqueda o filtro.' : 'Agregá uno con “Nuevo empleado” o importá tu planilla de Excel.'}</p></div></td></tr>`;
      $('#e-detail', el).innerHTML = detail();
      $('#e-detail', el).classList.toggle('open', sheetOpen && isNarrow());
      pageRows = info.rows;
      $('#e-head', el).innerHTML = `${selectMode ? '<th class="sel-col"><input type="checkbox" class="pick" data-pick-all aria-label="Seleccionar la página"></th>' : ''}<th>Legajo</th><th>Nombre y apellido</th><th>DNI</th><th>Sector</th><th>Estado</th><th class="actions">Acciones</th>`;
      const ha = $('[data-pick-all]', el);
      if (ha) { const n = pageRows.filter((x) => picked.has(x.id)).length; ha.checked = n > 0 && n === pageRows.length; ha.indeterminate = n > 0 && n < pageRows.length; }
      const bar = $('#e-bulk', el);
      bar.hidden = !selectMode;
      if (selectMode) bar.innerHTML = `<div class="bulk-info"><i class="fas fa-list-check"></i> <b>${picked.size}</b> seleccionado${picked.size === 1 ? '' : 's'}</div>
        <button type="button" class="btn btn-outline btn-sm" data-bulk-all>Seleccionar los ${list.length} de la lista</button>
        <button type="button" class="btn btn-ghost btn-sm" data-bulk-none ${picked.size ? '' : 'disabled'}>Ninguno</button>
        <span class="bulk-sp"></span>
        <button type="button" class="btn btn-danger btn-sm" data-bulk-del ${picked.size ? '' : 'disabled'}><i class="fas fa-trash"></i> Eliminar seleccionados</button>
        <button type="button" class="btn btn-ghost btn-sm" data-bulk-cancel>Cancelar</button>`;
      $('[data-action="bulk"]', el).hidden = selectMode;
    };

    function openForm(emp) {
      const body = document.createElement('div');
      body.innerHTML = formHTML();
      const form = body.querySelector('form');
      if (emp) fillForm(form, emp);
      form.querySelectorAll('.field > label').forEach((lb) => {
        const ctl = lb.parentElement.querySelector('[name]');
        if (!lb.querySelector('i') && ctl && ICONOS_CAMPO[ctl.name]) lb.insertAdjacentHTML('afterbegin', `<i class="fas ${ICONOS_CAMPO[ctl.name]}"></i>`);
      });
      $('#sectores-dl', form).innerHTML = sectores().map((s) => `<option value="${s.replace(/"/g, '&quot;')}">`).join('');
      const fotoIn = form.elements.foto, fotoPrev = form.querySelector('[data-foto-prev]'), fotoDel = form.querySelector('[data-foto-del]'), fotoFile = form.querySelector('[data-foto-file]');
      const paintFoto = () => { const v = fotoIn.value; fotoPrev.innerHTML = v ? `<img src="${v}" alt="">` : '<i class="fas fa-user"></i>'; fotoDel.hidden = !v; };
      paintFoto();
      form.querySelector('[data-foto-pick]').onclick = () => fotoFile.click();
      fotoDel.onclick = () => { fotoIn.value = ''; paintFoto(); };
      fotoFile.onchange = async () => {
        const file = fotoFile.files[0]; if (!file) return;
        try { fotoIn.value = await fileToPhoto(file); paintFoto(); }
        catch (err) { ctx.toast(err.code === 'FORMAT' ? 'Usá una imagen JPG, PNG o WebP.' : err.code === 'SIZE' ? 'La imagen es demasiado pesada.' : 'No se pudo leer la imagen.', 'error'); }
        fotoFile.value = '';
      };
      const el_ = (n) => form.elements[n];
      const vista = () => {
        const pas = el_('regimen').value === 'pasantia', hora = !pas && el_('modalidad').value === 'hora';
        form.querySelectorAll('[data-reg]').forEach((n) => { n.hidden = n.dataset.reg === 'pasantia' ? !pas : pas; });
        form.querySelectorAll('[data-mod]').forEach((n) => { if (!n.dataset.reg || !pas) n.hidden = n.dataset.mod === 'hora' ? !hora : hora; });
        $('#lbl-sueldo', form).textContent = pas ? 'Asignación estímulo mensual *' : 'Remuneración mensual bruta *';
        $('#cats-dl', form).innerHTML = categoriasDe(el_('convenio').value).map((c) => `<option value="${c}">`).join('');
        if (hora) {
          const vig = vigenciaEscala(el_('convenio').value, el_('categoria').value, el_('zona').value);
          const esc = vig?.valor;
          // Sin convenio en la ficha pero con una categoría que solo existe en uno: se completa solo.
          const deducido = !!vig && !el_('convenio').value;
          if (deducido) el_('convenio').value = vig.convenio;
          const cv = ESCALAS[el_('convenio').value], cat = el_('categoria').value;
          const porque = !el_('convenio').value ? 'Elegí el convenio (o una categoría que figure en la escala)'
            : !cv ? 'Ese convenio no tiene escala por hora cargada'
            : !cat.trim() ? 'Elegí la categoría'
            : !cv.categorias.some((c) => normCat(c) === normCat(cat)) ? `La categoría «${cat.trim()}» no figura en ${cv.nombre} (categorías: ${cv.categorias.join(', ')})`
            : `No hay valor cargado para la zona ${el_('zona').value} a la fecha de hoy`;
          const manual = el_('valorHoraManual').checked;
          el_('valorHora').readOnly = !manual;
          if (!manual && esc) el_('valorHora').value = esc;
          $('#vh-hint', form).textContent = manual ? 'Valor cargado a mano.' : esc ? `${deducido ? 'Convenio completado según la categoría. ' : ''}Tomado de la escala del convenio (vigente desde ${vig.desde.slice(8)}/${vig.desde.slice(5, 7)}/${vig.desde.slice(0, 4)}). Se actualiza solo según la fecha de cada liquidación.` : `${porque}. Podés cargar la escala en «Escalas y vigencias» (menú Cuenta) o tildar “a mano” y escribir el valor.`;
        }
      };
      el_('convenio').addEventListener('change', () => {
        if (ESCALAS[el_('convenio').value] && el_('regimen').value !== 'pasantia') { el_('modalidad').value = 'hora'; if (!el_('presentismoPct').value) el_('presentismoPct').value = ESCALAS[el_('convenio').value].presentismoPct; }
      });
      form.addEventListener('change', vista); form.addEventListener('input', (e) => { if (e.target.name === 'categoria') vista(); }); vista();
      const footer = document.createElement('div');
      footer.className = 'modal-actions';
      footer.innerHTML = '<button type="button" class="btn btn-ghost" data-c>Cancelar</button><button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>';
      const m = ctx.openModal({ title: emp ? 'Editar empleado' : 'Nuevo empleado', body, footer, size: 'lg' });
      footer.querySelector('[data-c]').onclick = m.close;
      footer.querySelector('[data-s]').onclick = async (ev) => {
        const btn = ev.currentTarget;
        form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; s.closest('.field')?.classList.remove('has-error'); });
        btn.setAttribute('aria-busy', 'true');
        try {
          const saved = await ctx.services.employees.save({ ...readForm(form), id: emp?.id });
          items = emp ? items.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...items];
          selId = saved.id; f.q = ''; $('#e-q', el).value = ''; pager.reset();
          draw(); m.close(); ctx.toast('Empleado guardado', 'success');
        } catch (err) {
          if (err.errors) {
            const msgs = Object.values(err.errors);
            for (const [k, msg] of Object.entries(err.errors)) {
              const s = form.querySelector(`[data-error="${k}"]`);
              if (s) { s.textContent = msg; s.closest('.field')?.classList.add('has-error'); }
            }
            ctx.toast(msgs[0], 'error');
            form.querySelector('.has-error input')?.focus();
          } else { console.error(err); ctx.toast('No se pudo guardar. Intentá de nuevo.', 'error'); }
        } finally { btn.removeAttribute('aria-busy'); }
      };
    }

    el.innerHTML = html`
      <div class="page-head">
        <div><h2>Empleados</h2><p>Gestioná el listado de empleados y sus datos laborales.</p></div>
        <div class="page-actions">
          <button class="btn btn-outline" data-action="import"><i class="fas fa-cloud-arrow-up"></i> Importar desde Excel</button>
          <button class="btn btn-outline" data-action="export"><i class="fas fa-download"></i> Exportar</button>
          <button class="btn btn-outline danger-outline" data-action="bulk"><i class="fas fa-trash-can"></i> Eliminar varios</button>
          <button class="btn btn-primary" data-action="new"><i class="fas fa-plus"></i> Nuevo empleado</button>
        </div>
      </div>
      <div class="emp-layout">
        <div class="card"><div class="card-body">
          <div class="toolbar">
            <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="e-q" type="search" placeholder="Buscar por nombre, legajo o DNI…"></div>
            <select class="select" id="e-sector"></select>
          </div>
          <div class="bulk-bar" id="e-bulk" hidden></div>
          <div class="table-wrap has-cards"><table class="table">
            <thead><tr id="e-head"></tr></thead>
            <tbody id="e-body"></tbody>
          </table></div>
          <div class="cards-list" id="e-cards"></div>
          <div class="muted-text" id="e-count" style="margin-top:.8rem;font-size:.85rem"></div>
          <div id="e-pager"></div>
        </div></div>
        <div class="card emp-detail" id="e-detail"></div>
      </div>`;
    pager.attach($('#e-pager', el));
    draw();

    $('#e-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); draw(); }, 150));
    $('#e-sector', el).addEventListener('change', (e) => { f.sector = e.target.value; pager.reset(); draw(); });
    on(el, 'click', '[data-row]', (e, r) => { if (e.target.closest('button,a,input,label')) return; selId = r.dataset.row; sheetOpen = isNarrow(); draw(); if (sheetOpen) $('#e-detail', el).scrollTop = 0; });
    on(el, 'click', '[data-close-detail]', () => { sheetOpen = false; draw(); });
    on(el, 'click', '[data-tab]', (_, b) => { tab = b.dataset.tab; $('#e-detail', el).innerHTML = detail(); });
    on(el, 'click', '[data-print]', async (_, b) => { b.setAttribute('aria-busy', 'true'); try { await printFicha(ctx, items.find((x) => x.id === b.dataset.print), runs); } finally { b.removeAttribute('aria-busy'); } });
    on(el, 'click', '[data-action="new"]', () => openForm(null));
    on(el, 'click', '[data-action="import"]', () => importDialog(ctx, items, async () => { items = await ctx.services.employees.list(); draw(); }));
    on(el, 'click', '[data-action="export"]', async (_, b) => {
      if (!items.length) return ctx.toast('No hay empleados para exportar.', 'info');
      b.setAttribute('aria-busy', 'true');
      try { await downloadXLSX(`empleados_${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Empleados', aoa: [TEMPLATE_HEADERS, ...employeesToRows(items)], widths: [26, 12, 16, 9, 20, 18, 20, 20, 34, 18, 11, 16, 14, 13, 14, 16, 16, 24, 24] }]); }
      catch { ctx.toast('No se pudo exportar. Revisá tu conexión.', 'error'); } finally { b.removeAttribute('aria-busy'); }
    });
    on(el, 'click', '[data-action="bulk"]', () => { selectMode = true; picked.clear(); draw(); });
    on(el, 'click', '[data-bulk-cancel]', () => { selectMode = false; picked.clear(); draw(); });
    on(el, 'click', '[data-bulk-none]', () => { picked.clear(); draw(); });
    on(el, 'click', '[data-bulk-all]', () => { filtered().forEach((x) => picked.add(x.id)); draw(); });
    on(el, 'change', '[data-pick-all]', (_, c) => { pageRows.forEach((x) => (c.checked ? picked.add(x.id) : picked.delete(x.id))); draw(); });
    on(el, 'change', '[data-pick]', (_, c) => { if (c.checked) picked.add(c.dataset.pick); else picked.delete(c.dataset.pick); draw(); });
    on(el, 'click', '[data-bulk-del]', async (_, b) => {
      const ids = [...picked].filter((id) => items.some((x) => x.id === id));
      if (!ids.length) return;
      if (!(await ctx.confirmDialog({ title: `Eliminar ${ids.length} empleado${ids.length === 1 ? '' : 's'}`, message: `Se eliminarán ${ids.length} fichas de forma definitiva. Las liquidaciones y nóminas ya guardadas se conservan. Esta acción no se puede deshacer.`, confirmText: `Eliminar ${ids.length}`, danger: true }))) return;
      b.setAttribute('aria-busy', 'true');
      try {
        const { okIds, failed } = await ctx.services.employees.removeMany(ids);
        const gone = new Set(okIds);
        items = items.filter((x) => !gone.has(x.id)); okIds.forEach((id) => picked.delete(id));
        if (!failed) { selectMode = false; picked.clear(); }
        pager.reset(); draw();
        ctx.toast(failed ? `Se eliminaron ${okIds.length}; ${failed} no se pudieron eliminar.` : `${okIds.length} empleado${okIds.length === 1 ? '' : 's'} eliminado${okIds.length === 1 ? '' : 's'}`, failed ? 'error' : 'success');
      } catch (err) { console.error(err); ctx.toast('No se pudo completar la eliminación.', 'error'); }
      finally { b.removeAttribute('aria-busy'); }
    });
    on(el, 'click', '[data-edit]', (_, b) => openForm(items.find((x) => x.id === b.dataset.edit)));
    on(el, 'click', '[data-del]', async (_, b) => {
      if (!(await ctx.confirmDialog({ title: 'Eliminar empleado', message: 'Se eliminará la ficha. Las liquidaciones y nóminas ya guardadas se conservan.', confirmText: 'Eliminar', danger: true }))) return;
      try { await ctx.services.employees.remove(b.dataset.del); items = items.filter((x) => x.id !== b.dataset.del); draw(); ctx.toast('Empleado eliminado', 'success'); }
      catch { ctx.toast('No se pudo eliminar', 'error'); }
    });
  },
};
