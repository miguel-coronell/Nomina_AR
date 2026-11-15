import { html, raw } from '../../../../core/html.js';
import { $, on, debounce } from '../../../../core/dom.js';
import { addDays, daysInMonth, parseISO, toISO } from '../../../../core/dates.js';
import { MESES, mesNombre, todayISO, dateAR } from '../../../../core/format.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { statValue } from '../../../../core/ui/stat.js';
import { toCSV, downloadFile } from '../../../../core/csv.js';
import { feriadosDelAnio } from '../../../../domain/hr/feriados.js';
import { DIAS, horarioTexto, horasSemanales, horasPactadas } from '../../../../domain/hr/horario.js';
import { evaluarDia, resumenPeriodo } from '../../../../domain/hr/asistencia.js';
import { intervalos } from '../../../../domain/hr/horas.js';
import { TIPOS_DIA, LICENCIAS, licenciaLabel } from '../../../../domain/hr/licencias.js';
import { feriadosDialog, licenciaDialog } from './dialogs.js';

const pad = (n) => String(n).padStart(2, '0');
const nombreDia = (iso) => DIAS.find(([d]) => d === new Date(`${iso}T00:00:00Z`).getUTCDay())?.[2] || '';
const activoEn = (e, desde, hasta) => e.fechaIngreso <= hasta && (!e.fechaEgreso || e.fechaEgreso >= desde);

/* ============================ RESUMEN DEL MES ============================ */
async function mountResumen(el, ctx, y, m) {
  const desde = `${y}-${pad(m)}-01`, hasta = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
  const [emps, mes] = await Promise.all([ctx.services.employees.list(), ctx.services.attendance.getMonth(y, m)]);
  let feriados = feriadosDelAnio(y, ctx.state.settings.feriados);
  const lista = emps.filter((e) => activoEn(e, desde, hasta)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const filas = () => lista.map((e) => ({ e, r: resumenPeriodo(e, desde, hasta, mes[e.id] || {}, feriados, { hoy: todayISO() }) }));
  let datos = filas();
  const f = { q: '', filtro: '' };
  const pager = createPager({ onChange: () => rows() });
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1], next = m === 12 ? [y + 1, 1] : [y, m + 1];
  const ferMes = [...feriados.entries()].filter(([k]) => k.startsWith(`${y}-${pad(m)}`)).sort(([a], [b]) => a.localeCompare(b));

  el.innerHTML = html`
    <div class="page-head">
      <div><h2>Asistencia y control horario</h2><p>Horas trabajadas, extras, faltas, licencias y feriados de cada empleado.</p></div>
      <div class="page-actions">
        <button class="btn btn-outline" data-action="feriados"><i class="fas fa-calendar-day"></i> Calendario de feriados</button>
        <button class="btn btn-outline" data-action="csv"><i class="fas fa-file-csv"></i> Exportar CSV</button>
      </div>
    </div>
    <div class="period-nav">
      <a class="icon-btn" href="#/asistencia?y=${prev[0]}&m=${prev[1]}" aria-label="Mes anterior"><i class="fas fa-angle-left"></i></a>
      <strong>${MESES[m - 1]} ${y}</strong>
      <a class="icon-btn" href="#/asistencia?y=${next[0]}&m=${next[1]}" aria-label="Mes siguiente"><i class="fas fa-angle-right"></i></a>
      ${ferMes.length ? html`<span class="muted-text" style="font-size:.82rem">Feriados del mes: ${ferMes.map(([k, v]) => html`<span class="badge ${v.tipo === 'feriado' ? 'badge-danger' : 'badge-warning'}" title="${v.nombre}">${k.slice(8)}/${k.slice(5, 7)}</span> `)}</span>` : ''}
    </div>
    <div class="grid grid-4" id="att-kpis" style="margin-bottom:1.2rem"></div>
    <div class="card"><div class="card-body">
      <div class="toolbar">
        <div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="a-q" type="search" placeholder="Buscar por nombre, legajo o documento…"></div>
        <select class="select" id="a-f"><option value="">Todos</option><option value="pend">Con días sin registrar</option><option value="falt">Con faltas injustificadas</option><option value="ext">Con horas extras</option></select>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Empleado</th><th>Jornada pactada</th><th class="num">Días</th><th class="num">Horas</th><th class="num">Extras 50%</th><th class="num">Extras 100%</th><th class="num">Feriados trab.</th><th class="num">F. injust.</th><th class="num">Licencias</th><th class="num">Sin registrar</th><th></th></tr></thead>
        <tbody id="a-body"></tbody></table></div><div id="a-pager"></div>
    </div></div>`;

  function kpis() {
    const t = (k) => datos.reduce((a, d) => a + d.r[k], 0);
    const bancoTot = datos.reduce((a, d) => a + d.r.bancoGen, 0);
    $('#att-kpis', el).innerHTML = html`
      <div class="card stat"><div class="ico blue"><i class="fas fa-user-clock"></i></div><div><small>Empleados con jornada</small><strong>${datos.length}</strong></div></div>
      <div class="card stat"><div class="ico amber"><i class="fas fa-business-time"></i></div><div><small>Horas extra del mes</small>${statValue(`${(t('he50') + t('he100')).toFixed(1).replace('.', ',')} hs${bancoTot ? ` (+${bancoTot.toFixed(1).replace('.', ',')} banco)` : ''}`)}</div></div>
      <div class="card stat"><div class="ico violet"><i class="fas fa-user-xmark"></i></div><div><small>Faltas injustificadas</small><strong>${t('faltasInj')}</strong></div></div>
      <div class="card stat"><div class="ico green"><i class="fas fa-umbrella-beach"></i></div><div><small>Licencias y vacaciones (días)</small><strong>${t('licencias')}</strong></div></div>`;
  }

  function rows() {
    const match = matcher(f.q);
    const list = datos.filter(({ e, r }) => match(e.nombre, e.dni, e.cuil, e.legajo) &&
      (!f.filtro || (f.filtro === 'pend' ? r.sinRegistrar > 0 : f.filtro === 'falt' ? r.faltasInj > 0 : r.he50 + r.he100 + r.bancoGen > 0)));
    const info = pager.apply(list);
    $('#a-pager', el).innerHTML = pager.view(info);
    const n1 = (v) => (v ? String(v).replace('.', ',') : '—');
    $('#a-body', el).innerHTML = list.length ? info.rows.map(({ e, r }) => html`<tr>
      <td><strong>${e.nombre}</strong> ${e.regimen === 'pasantia' ? html`<span class="badge">Pasante</span>` : ''}${e.bancoHoras ? html` <span class="badge badge-gray" title="Banco de horas pactado">Banco hs</span>` : ''}<br><small class="muted-text">${[e.legajo && `Leg. ${e.legajo}`, e.dni && `DNI ${e.dni}`].filter(Boolean).join(' · ')}</small></td>
      <td><small>${horarioTexto(e.horario)}</small><br><small class="muted-text">${horasSemanales(e.horario)} hs semanales</small></td>
      <td class="num">${r.diasTrab || '—'}</td><td class="num">${n1(r.hsTrab)}</td>
      <td class="num">${n1(r.he50)}${r.bancoGen ? html`<br><small class="muted-text">+${n1(r.bancoGen)} banco</small>` : ''}</td><td class="num">${n1(r.he100)}</td><td class="num">${r.feriadosTrab || '—'}</td>
      <td class="num">${r.faltasInj ? html`<span class="badge badge-danger">${r.faltasInj}</span>` : '—'}</td><td class="num">${r.licencias || '—'}</td>
      <td class="num">${r.sinRegistrar ? html`<span class="badge badge-warning">${r.sinRegistrar}</span>` : html`<i class="fas fa-circle-check" style="color:var(--success)"></i>`}</td>
      <td class="actions"><a class="btn btn-outline btn-sm" href="#/asistencia?emp=${e.id}&y=${y}&m=${m}"><i class="fas fa-pen-to-square"></i> Cargar</a></td></tr>`).join('')
      : html`<tr><td colspan="11"><div class="empty"><i class="fas fa-user-clock"></i><h4>${lista.length ? 'Sin resultados' : 'No hay empleados activos en este mes'}</h4></div></td></tr>`;
    kpis();
  }
  pager.attach($('#a-pager', el)); rows();
  $('#a-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); rows(); }, 150));
  $('#a-f', el).addEventListener('change', (e) => { f.filtro = e.target.value; pager.reset(); rows(); });
  on(el, 'click', '[data-action="feriados"]', () => feriadosDialog(ctx, y, () => { feriados = feriadosDelAnio(y, ctx.state.settings.feriados); datos = filas(); rows(); }));
  on(el, 'click', '[data-action="csv"]', () => {
    if (!datos.length) return ctx.toast('No hay datos para exportar.', 'info');
    const cols = [['Legajo', (d) => d.e.legajo], ['Empleado', (d) => d.e.nombre], ['DNI', (d) => d.e.dni], ['Días trabajados', (d) => d.r.diasTrab], ['Horas trabajadas', (d) => d.r.hsTrab], ['Extras 50%', (d) => d.r.he50], ['Extras 100%', (d) => d.r.he100], ['Banco de horas generado', (d) => d.r.bancoGen], ['Feriados trabajados', (d) => d.r.feriadosTrab], ['Faltas injustificadas', (d) => d.r.faltasInj], ['Faltas justificadas', (d) => d.r.faltasJust], ['Licencia sin goce', (d) => d.r.sinGoce], ['Licencias / vacaciones', (d) => d.r.licencias]];
    downloadFile(`asistencia_${y}_${pad(m)}.csv`, toCSV(datos, cols.map(([label, value]) => ({ label, value }))));
  });
}

/* ============================ GRILLA DIARIA ============================ */
async function mountGrilla(el, ctx, emp, y, m) {
  const desde = `${y}-${pad(m)}-01`, hasta = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
  let feriados = feriadosDelAnio(y, ctx.state.settings.feriados);
  let days = await ctx.services.attendance.getEmployeeMonth(y, m, emp.id);
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1], next = m === 12 ? [y + 1, 1] : [y, m + 1];
  const fechas = Array.from({ length: daysInMonth(y, m) }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
  const vigente = (iso) => iso >= emp.fechaIngreso && (!emp.fechaEgreso || iso <= emp.fechaEgreso);
  let timer;

  const estado = (txt, cls = '') => { const s = $('#att-status', el); if (s) { s.textContent = txt; s.className = `muted-text ${cls}`; } };
  const guardar = () => {
    estado('Guardando…');
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await ctx.services.attendance.saveEmployeeMonth(y, m, emp.id, days); estado('Guardado ✓', 'ok-text'); }
      catch (e) { console.error(e); estado('No se pudo guardar', 'err-text'); ctx.toast('No se pudo guardar la asistencia.', 'error'); }
    }, 600);
  };

  const hsTxt = (v) => (v ? `${String(Math.round(v * 100) / 100).replace('.', ',')} h` : '');
  const detalle = (iso, rec, ev) => {
    if (!rec?.t) return '';
    if (rec.t === 'T') {
      const iv = rec.i || [];
      return html`<div class="times">
        ${iv.map(([e, x], k) => html`<span class="turno"><input class="input sm" type="time" data-f="e" data-k="${k}" value="${e || ''}" aria-label="Entrada"><span class="sep">→</span><input class="input sm" type="time" data-f="s" data-k="${k}" value="${x || ''}" aria-label="Salida"><button type="button" class="icon-btn" data-del-turno="${k}" title="Quitar turno" style="width:26px;height:26px"><i class="fas fa-xmark"></i></button></span>`)}
        <button type="button" class="btn btn-ghost btn-sm" data-add-turno><i class="fas fa-plus"></i> ${iv.length ? 'Turno' : 'Entrada / salida'}</button>
        ${iv.length ? '' : html`<span class="muted-text">o</span><input class="input sm" type="number" min="0" max="24" step="0.25" data-f="h" value="${rec.h ?? ''}" placeholder="${ev.pact}" aria-label="Horas trabajadas"><span class="muted-text">hs</span>`}
        <span class="hs-calc" data-calc>${hsTxt(ev.horas)}</span>
        <select class="select sm" data-f="rec" title="Recargo de las horas extra"><option value="">Recargo automático</option><option value="50" ${rec.rec === '50' ? 'selected' : ''}>Extras al 50%</option><option value="100" ${rec.rec === '100' ? 'selected' : ''}>Extras al 100%</option></select></div>`;
    }
    if (rec.t === 'L') return html`<select class="select sm" data-f="l">${LICENCIAS.map((l) => html`<option value="${l.id}" ${rec.l === l.id ? 'selected' : ''}>${l.label}</option>`)}</select>`;
    if (rec.t === 'BH') return html`<input class="input sm" type="number" min="0" max="24" step="0.25" data-f="h" value="${rec.h ?? ''}" placeholder="${ev.pact}"><span class="muted-text"> hs de banco</span>`;
    return '';
  };
  const extraTxt = (ev) => {
    const p = [];
    if (ev.he50) p.push(`${ev.he50} hs al 50%`);
    if (ev.he100) p.push(`${ev.he100} hs al 100%`);
    if (ev.bancoGen) p.push(`+${ev.bancoGen} hs al banco`);
    if (ev.bancoUsado) p.push(`−${ev.bancoUsado} hs del banco`);
    if (ev.feriadoTrab) p.push('día adicional (feriado)');
    if (ev.faltante) p.push(`<span style="color:var(--warning)">faltan ${ev.faltante} hs</span>`);
    return p.join(' · ');
  };

  function filaHTML(iso) {
    const rec = days[iso], fer = feriados.get(iso), ev = evaluarDia(emp, iso, rec, fer);
    const ok = vigente(iso);
    const fin = ev.dow === 0 || ev.dow === 6;
    return html`<tr data-iso="${iso}" class="${fer?.tipo === 'feriado' ? 'row-fer' : fin || ev.pact === 0 ? 'row-fin' : ''} ${ok ? '' : 'row-off'}">
      <td class="date"><b>${nombreDia(iso)}</b> ${iso.slice(8)}/${iso.slice(5, 7)}${fer ? html`<br><span class="badge ${fer.tipo === 'feriado' ? 'badge-danger' : 'badge-warning'}" title="${fer.nombre}">${fer.tipo === 'feriado' ? 'Feriado' : 'No laborable'}</span>` : ''}</td>
      <td class="num">${ev.pact ? `${ev.pact} h` : '—'}</td>
      <td><select class="select sm" data-f="t" ${ok ? '' : 'disabled'}><option value="">${ev.laborable ? '— Sin registrar —' : fer?.tipo === 'feriado' ? 'Feriado' : 'Descanso'}</option>${Object.entries(TIPOS_DIA).map(([k, v]) => html`<option value="${k}" ${rec?.t === k ? 'selected' : ''}>${v.label}</option>`)}</select></td>
      <td data-detalle>${detalle(iso, rec, ev)}</td>
      <td class="extras" data-extra>${raw(extraTxt(ev))}</td>
      <td><input class="input sm" data-f="n" maxlength="120" value="${rec?.n || ''}" placeholder="Nota" ${ok ? '' : 'disabled'}></td></tr>`;
  }

  function resumen() {
    const r = resumenPeriodo(emp, desde, hasta, days, feriados, { hoy: todayISO() });
    $('#att-sum', el).innerHTML = html`
      <div class="chips-sum">
        <span><b>${r.diasTrab}</b> días trabajados</span><span><b>${String(r.hsTrab).replace('.', ',')}</b> hs totales</span>
        <span class="${r.he50 ? 'hl' : ''}"><b>${String(r.he50).replace('.', ',')}</b> extras 50%</span><span class="${r.he100 ? 'hl' : ''}"><b>${String(r.he100).replace('.', ',')}</b> extras 100%</span>
        <span><b>${r.feriadosTrab}</b> feriados trabajados</span><span class="${r.faltasInj ? 'bad' : ''}"><b>${r.faltasInj}</b> faltas injustificadas</span>
        <span><b>${r.faltasJust}</b> justificadas</span><span><b>${r.licencias}</b> licencias</span><span><b>${r.sinGoce}</b> sin goce</span>
        ${emp.bancoHoras ? html`<span class="hl"><b>${String(r.bancoGen).replace('.', ',')}</b> hs al banco · <b>${String(r.bancoUsado).replace('.', ',')}</b> usadas</span>` : ''}
        <span class="${r.sinRegistrar ? 'bad' : ''}"><b>${r.sinRegistrar}</b> sin registrar</span>
      </div>
      ${r.avisos.map((a) => html`<div class="alert alert-warning" style="margin-top:.5rem"><i class="fas fa-triangle-exclamation"></i><div>${a}</div></div>`)}`;
  }

  el.innerHTML = html`
    <div class="page-head">
      <div><a class="back-home" href="#/asistencia?y=${y}&m=${m}"><i class="fas fa-arrow-left"></i> Resumen del mes</a>
        <h2>${emp.nombre} ${emp.regimen === 'pasantia' ? html`<span class="badge">Pasante</span>` : ''}</h2>
        <p>Jornada pactada: ${horarioTexto(emp.horario)} (${horasSemanales(emp.horario)} hs semanales)${emp.bancoHoras ? ' · banco de horas' : ''}</p></div>
      <div class="page-actions">
        <button class="btn btn-outline" data-action="fill"><i class="fas fa-wand-magic-sparkles"></i> Completar jornada habitual</button>
        <button class="btn btn-outline" data-action="lic"><i class="fas fa-umbrella-beach"></i> Licencia / ausencia (rango)</button>
        <button class="btn btn-outline" data-action="csv"><i class="fas fa-file-csv"></i> Hoja de asistencia</button>
        <button class="btn btn-ghost" data-action="clear"><i class="fas fa-eraser"></i> Limpiar mes</button>
      </div>
    </div>
    <div class="period-nav">
      <a class="icon-btn" href="#/asistencia?emp=${emp.id}&y=${prev[0]}&m=${prev[1]}"><i class="fas fa-angle-left"></i></a>
      <strong>${MESES[m - 1]} ${y}</strong>
      <a class="icon-btn" href="#/asistencia?emp=${emp.id}&y=${next[0]}&m=${next[1]}"><i class="fas fa-angle-right"></i></a>
      <span id="att-status" class="muted-text"></span>
    </div>
    <div class="card" style="margin-bottom:1rem"><div class="card-body" id="att-sum"></div></div>
    <div class="card"><div class="table-wrap"><table class="table att-grid">
      <thead><tr><th>Día</th><th class="num">Pactado</th><th>Registro</th><th>Detalle</th><th>Resultado</th><th>Nota</th></tr></thead>
      <tbody id="att-body">${fechas.map(filaHTML)}</tbody></table></div>
      <div class="card-footer"><small class="muted-text">Horas sobre la jornada pactada: 50% (sábado y días de descanso: 100%). Feriado trabajado: día adicional (art. 166 LCT). Con banco de horas las extras se acumulan en vez de pagarse (art. 197 bis, Ley 27.802). El registro se guarda solo.</small></div></div>`;
  resumen();

  const row = (iso) => $(`tr[data-iso="${iso}"]`, el);
  function refrescarFila(iso, rerender = false) {
    const rec = days[iso], ev = evaluarDia(emp, iso, rec, feriados.get(iso));
    const tr = row(iso);
    if (rerender) $('[data-detalle]', tr).innerHTML = detalle(iso, rec, ev);
    $('[data-extra]', tr).innerHTML = extraTxt(ev);
    const calc = $('[data-calc]', tr); if (calc) calc.textContent = hsTxt(ev.horas);
    resumen();
  }

  on(el, 'change', '[data-f]', (e, c) => {
    const tr = c.closest('tr'), iso = tr.dataset.iso, k = c.dataset.f;
    const rec = { ...(days[iso] || {}) };
    if (k === 't') {
      if (!c.value) { delete days[iso]; }
      else {
        const nota = rec.n;
        const base = { t: c.value, ...(nota ? { n: nota } : {}) };
        if (c.value === 'T') base.h = horasPactadas(emp.horario, iso) || undefined;
        if (c.value === 'L') base.l = 'vacaciones';
        if (c.value === 'BH') base.h = horasPactadas(emp.horario, iso) || undefined;
        days[iso] = base;
      }
      refrescarFila(iso, true);
    } else {
      if (!rec.t && k === 'n') return;
      if (k === 'h') { rec.h = c.value === '' ? undefined : Number(c.value); }
      else if (c.value) rec[k] = c.value; else delete rec[k];
      days[iso] = rec;
      refrescarFila(iso, false);
    }
    guardar();
  });
  const iv = (iso) => { const d = (days[iso] ||= { t: 'T' }); d.i = d.i || []; return d; };
  on(el, 'click', '[data-add-turno]', (_, b) => {
    const iso = b.closest('tr').dataset.iso, d = iv(iso);
    d.i.push(['', '']); delete d.h; refrescarFila(iso, true);
  });
  on(el, 'click', '[data-del-turno]', (_, b) => {
    const iso = b.closest('tr').dataset.iso, d = iv(iso);
    d.i.splice(Number(b.dataset.delTurno), 1); if (!d.i.length) delete d.i; refrescarFila(iso, true); guardar();
  });
  on(el, 'change', 'input[data-k]', (_, c) => {
    const iso = c.closest('tr').dataset.iso, d = iv(iso), k = Number(c.dataset.k);
    d.i[k] = d.i[k] || ['', ''];
    d.i[k][c.dataset.f === 'e' ? 0 : 1] = c.value || (c.dataset.f === 'e' ? '' : null);
    delete d.h; refrescarFila(iso, false); guardar();
  });
  on(el, 'input', 'input[data-f="h"]', (_, c) => {
    const iso = c.closest('tr').dataset.iso;
    days[iso] = { ...(days[iso] || {}), h: c.value === '' ? undefined : Number(c.value) };
    refrescarFila(iso, false); guardar();
  });

  on(el, 'click', '[data-action="fill"]', async () => {
    let n = 0;
    fechas.forEach((iso) => {
      const p = horasPactadas(emp.horario, iso);
      if (!days[iso] && vigente(iso) && p > 0 && feriados.get(iso)?.tipo !== 'feriado') { days[iso] = { t: 'T', h: p }; n += 1; }
    });
    if (!n) return ctx.toast('No hay días pendientes para completar.', 'info');
    fechas.forEach((iso) => { $('[data-f="t"]', row(iso)).value = days[iso]?.t || ''; refrescarFila(iso, true); });
    guardar(); ctx.toast(`Se completaron ${n} día(s) con la jornada pactada.`, 'success');
  });
  on(el, 'click', '[data-action="csv"]', () => {
    const filas = fechas.map((iso) => { const ev = evaluarDia(emp, iso, days[iso], feriados.get(iso)); const iv2 = intervalos(days[iso]); return { iso, ev, rec: days[iso], iv: iv2 }; });
    const col = (label, value) => ({ label, value });
    downloadFile(`hoja_asistencia_${emp.nombre.replace(/[^a-zA-Z0-9]+/g, '_')}_${y}_${pad(m)}.csv`, toCSV(filas, [
      col('Fecha', (r) => dateAR(r.iso)), col('Día', (r) => nombreDia(r.iso)), col('Jornada pactada (hs)', (r) => r.ev.pact),
      col('Registro', (r) => (r.rec ? TIPOS_DIA[r.rec.t]?.label : '')), col('Entrada 1', (r) => r.iv[0]?.[0] || ''), col('Salida 1', (r) => r.iv[0]?.[1] || ''),
      col('Entrada 2', (r) => r.iv[1]?.[0] || ''), col('Salida 2', (r) => r.iv[1]?.[1] || ''), col('Horas trabajadas', (r) => r.ev.horas || ''),
      col('Extras 50%', (r) => r.ev.he50 || ''), col('Extras 100%', (r) => r.ev.he100 || ''), col('Banco de horas', (r) => r.ev.bancoGen || ''), col('Nota', (r) => r.rec?.n || ''),
    ]));
  });
  on(el, 'click', '[data-action="clear"]', async () => {
    if (!(await ctx.confirmDialog({ title: 'Limpiar mes', message: `Se borrarán todos los registros de ${emp.nombre} en ${MESES[m - 1]} ${y}.`, confirmText: 'Limpiar', danger: true }))) return;
    days = {}; await ctx.services.attendance.saveEmployeeMonth(y, m, emp.id, days);
    await mountGrilla(el, ctx, emp, y, m); ctx.toast('Mes limpiado', 'success');
  });
  on(el, 'click', '[data-action="lic"]', () => licenciaDialog(ctx, emp, desde, feriadosEntreAnios(ctx, y), async (dias, rec) => {
    const porMes = {};
    dias.forEach((iso) => { (porMes[iso.slice(0, 7)] ||= []).push(iso); });
    for (const [ym, lista] of Object.entries(porMes)) {
      const [yy, mm] = ym.split('-').map(Number);
      const actual = ym === `${y}-${pad(m)}` ? days : await ctx.services.attendance.getEmployeeMonth(yy, mm, emp.id);
      lista.forEach((iso) => { actual[iso] = { ...rec }; });
      await ctx.services.attendance.saveEmployeeMonth(yy, mm, emp.id, actual);
    }
    await mountGrilla(el, ctx, emp, y, m);
    ctx.toast(`Registrados ${dias.length} día(s)${Object.keys(porMes).length > 1 ? ' en varios meses' : ''}.`, 'success');
  }));
  return () => clearTimeout(timer);
}

const feriadosEntreAnios = (ctx, y) => new Map([...feriadosDelAnio(y, ctx.state.settings.feriados), ...feriadosDelAnio(y + 1, ctx.state.settings.feriados)]);

export default {
  id: 'asistencia', title: 'Asistencia', icon: 'fa-user-clock', group: 'Recursos Humanos',
  async mount(el, ctx, params) {
    const now = new Date();
    const y = Number(params.get('y')) || now.getFullYear(), m = Math.min(12, Math.max(1, Number(params.get('m')) || now.getMonth() + 1));
    const empId = params.get('emp');
    if (empId) {
      const emp = await ctx.services.employees.get(empId);
      if (!emp) { el.innerHTML = html`<div class="card"><div class="card-body empty"><h4>No encontramos al empleado</h4><a class="btn btn-primary" href="#/asistencia" style="margin-top:1rem">Volver</a></div></div>`; return; }
      return mountGrilla(el, ctx, { ...emp, horario: emp.horario || undefined }, y, m);
    }
    return mountResumen(el, ctx, y, m);
  },
};
