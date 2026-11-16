import { html } from '../../../../core/html.js';
import { $, debounce } from '../../../../core/dom.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { readFirstSheet, downloadXLSX } from '../../../../core/xlsx.js';
import { TEMPLATE_HEADERS, TEMPLATE_EXAMPLE, TEMPLATE_HELP, parseEmployeeRows } from '../../../../services/employee-import.js';

const ICON = { nuevo: ['fa-circle-plus', 'badge-success', 'Nuevo'], actualizar: ['fa-pen', 'badge', 'Actualizar'], error: ['fa-circle-xmark', 'badge-danger', 'Error'] };

export function downloadTemplate() {
  return downloadXLSX('plantilla_empleados_nomina-ar.xlsx', [
    { name: 'Empleados', aoa: [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE], widths: [26, 12, 16, 9, 20, 18, 20, 20, 34, 18, 11, 16, 14, 13, 14, 16, 16, 24, 24] },
    { name: 'Instrucciones', aoa: TEMPLATE_HELP, widths: [26, 110] },
  ]);
}

/** Asistente de importación: plantilla → archivo → vista previa → importación. */
export function importDialog(ctx, existing, onDone) {
  let q = '', filtro = '';
  const pager = createPager({ sizes: [10, 25, 50], onChange: () => drawPreview() });
  let parsed = null, rawRows = null, updateExisting = true, importing = false, result = null, fileName = '';
  const body = document.createElement('div');
  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  const m = ctx.openModal({ title: 'Importar empleados desde Excel', body, footer, size: 'lg', onClose: () => { if (result) onDone(); } });

  const parse = () => { parsed = parseEmployeeRows(rawRows, existing, { updateExisting }); };
  const valid = () => (parsed?.rows || []).filter((r) => r.status !== 'error');

  function draw() {
    const rows = parsed?.rows || [];
    const count = (s) => rows.filter((r) => r.status === s).length;

    if (result) {
      body.innerHTML = html`<div class="empty"><i class="fas fa-circle-check" style="color:var(--success);opacity:1"></i><h4>Importación finalizada</h4>
        <p><strong>${result.ok}</strong> empleado(s) importados${result.failed ? html` · <span style="color:var(--danger)">${result.failed} con error al guardar</span>` : ''}.</p></div>`;
      footer.innerHTML = '<button class="btn btn-primary" data-close>Listo</button>';
      return;
    }

    body.innerHTML = html`
      <div class="import-steps">
        <div class="import-step"><b>1</b><div><strong>Descargá la plantilla</strong><p class="muted-text">Completala con tus empleados (una fila por persona).</p>
          <button class="btn btn-outline btn-sm" data-template><i class="fas fa-file-excel"></i> Descargar plantilla .xlsx</button></div></div>
        <div class="import-step"><b>2</b><div style="flex:1"><strong>Subí el archivo completo</strong>
          <label class="dropzone" id="dz"><i class="fas fa-cloud-arrow-up"></i><span>${fileName ? html`<b>${fileName}</b> — hacé clic para cambiarlo` : 'Arrastrá tu archivo acá o hacé clic para elegirlo'}</span><small>.xlsx, .xls o .csv</small>
            <input type="file" id="file" accept=".xlsx,.xls,.csv" hidden></label>
          <label class="check" style="margin-top:.7rem"><input type="checkbox" id="upd" ${updateExisting ? 'checked' : ''}><span>Actualizar fichas existentes si coincide el DNI<small>Si lo desmarcás, los DNI ya cargados se informan como error.</small></span></label></div></div>
      </div>
      ${parsed?.missingColumns?.length ? html`<div class="alert alert-error" style="margin-top:1rem"><i class="fas fa-circle-exclamation"></i><div>Faltan columnas obligatorias: <strong>${parsed.missingColumns.map((c) => ({ nombre: 'Apellido y nombre', fechaIngreso: 'Fecha de ingreso', sueldo: 'Remuneración mensual bruta' }[c])).join(', ')}</strong>. Usá la plantilla oficial.</div></div>` : ''}
      ${parsed && !parsed.missingColumns.length ? html`
        <div class="chips" style="margin:1rem 0 .6rem">
          <span class="badge badge-success">${count('nuevo')} nuevos</span><span class="badge">${count('actualizar')} a actualizar</span>
          <span class="badge ${count('error') ? 'badge-danger' : 'badge-gray'}">${count('error')} con errores</span><span class="badge badge-gray">${rows.length} filas leídas</span></div>
        <div class="toolbar" style="margin-bottom:.6rem">
          <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="pv-q" type="search" placeholder="Buscar por nombre, legajo o documento…" value="${q}"></div>
          <select class="select" id="pv-f"><option value="">Todas las filas</option><option value="error" ${filtro === 'error' ? 'selected' : ''}>Solo con errores</option><option value="nuevo" ${filtro === 'nuevo' ? 'selected' : ''}>Solo nuevos</option><option value="actualizar" ${filtro === 'actualizar' ? 'selected' : ''}>Solo a actualizar</option></select>
        </div>
        <div class="table-wrap" style="border:1px solid var(--border);border-radius:12px"><table class="table">
          <thead><tr><th>Fila</th><th>Empleado</th><th>DNI</th><th>Legajo</th><th class="num">Remuneración</th><th>Resultado</th></tr></thead>
          <tbody id="pv-body"></tbody></table></div><div id="pv-pager"></div>` : ''}
      ${importing ? html`<div class="progress" style="margin-top:1rem"><i id="bar" style="width:0%"></i></div><small class="muted-text" id="bar-t">Importando…</small>` : ''}`;

    if (parsed && !parsed.missingColumns.length) { pager.attach($('#pv-pager', body)); drawPreview(); }
    const n = valid().length;
    footer.innerHTML = `<button class="btn btn-ghost" data-close ${importing ? 'disabled' : ''}>Cancelar</button>
      <button class="btn btn-primary" data-go ${n && !importing ? '' : 'disabled'}><i class="fas fa-file-import"></i> Importar ${n || ''} empleado(s)</button>`;
  }

  function drawPreview() {
    const match = matcher(q);
    const list = (parsed?.rows || []).filter((r) => (!filtro || r.status === filtro) && match(r.data.nombre, r.data.dni, r.data.legajo, r.data.cuil));
    const info = pager.apply(list);
    $('#pv-pager', body).innerHTML = pager.view(info);
    $('#pv-body', body).innerHTML = list.length ? info.rows.map((r) => { const [ic, cls, lb] = ICON[r.status]; return html`<tr>
      <td>${r.n}</td><td>${r.data.nombre || '—'}</td><td>${r.data.dni || '—'}</td><td>${r.data.legajo || '—'}</td><td class="num">${r.data.sueldo ? r.data.sueldo.toLocaleString('es-AR') : '—'}</td>
      <td><span class="badge ${cls}"><i class="fas ${ic}"></i> ${lb}</span>${[...r.errors, ...r.warnings].map((x) => html`<br><small class="${r.errors.includes(x) ? '' : 'muted-text'}" style="${r.errors.includes(x) ? 'color:var(--danger)' : ''}">${x}</small>`)}</td></tr>`; }).join('')
      : html`<tr><td colspan="6"><div class="empty"><h4>Sin resultados</h4></div></td></tr>`;
  }

  async function load(file) {
    if (!file) return;
    fileName = file.name;
    try {
      rawRows = await readFirstSheet(file);
      if (!rawRows.length) { parsed = { rows: [], missingColumns: [] }; ctx.toast('El archivo no tiene filas de datos.', 'warning'); }
      else parse();
    } catch (e) { console.error(e); parsed = null; rawRows = null; ctx.toast('No se pudo leer el archivo. Verificá que sea un Excel o CSV válido.', 'error'); }
    draw();
  }

  async function run() {
    importing = true; draw();
    const items = valid().map((r) => ({ data: r.data, id: r.id }));
    const res = await ctx.services.employees.importMany(items, (done, total) => {
      const bar = $('#bar', body); if (bar) bar.style.width = `${Math.round((done / total) * 100)}%`;
      const t = $('#bar-t', body); if (t) t.textContent = `Importando ${done} de ${total}…`;
    });
    importing = false; result = res; draw();
  }

  body.addEventListener('click', (e) => { if (e.target.closest('[data-template]')) downloadTemplate().catch(() => ctx.toast('No se pudo generar la plantilla. Revisá tu conexión.', 'error')); });
  body.addEventListener('input', debounce((e) => { if (e.target.id === 'pv-q') { q = e.target.value; pager.reset(); drawPreview(); } }, 150));
  body.addEventListener('change', (e) => {
    if (e.target.id === 'pv-f') { filtro = e.target.value; pager.reset(); drawPreview(); }
    if (e.target.id === 'file') load(e.target.files[0]);
    if (e.target.id === 'upd') { updateExisting = e.target.checked; if (rawRows) { parse(); draw(); } }
  });
  body.addEventListener('dragover', (e) => { if (e.target.closest('#dz')) e.preventDefault(); });
  body.addEventListener('drop', (e) => { if (e.target.closest('#dz')) { e.preventDefault(); load(e.dataTransfer.files[0]); } });
  footer.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) m.close();
    if (e.target.closest('[data-go]')) run();
  });
  draw();
}
