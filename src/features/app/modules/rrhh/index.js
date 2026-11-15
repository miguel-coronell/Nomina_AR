import { html } from '../../../../core/html.js';
import { $, on, debounce, readForm } from '../../../../core/dom.js';
import { daysBetween, daysInMonth, parseISO } from '../../../../core/dates.js';
import { MESES, dateAR, todayISO, money } from '../../../../core/format.js';
import { matcher } from '../../../../core/search.js';
import { createPager } from '../../../../core/ui/pager.js';
import { calcAntiguedad } from '../../../../domain/liquidation/rules/antiguedad.js';
import { feriadosDelAnio } from '../../../../domain/hr/feriados.js';
import { resumenPeriodo } from '../../../../domain/hr/asistencia.js';
import { diasVacaciones } from '../../../../domain/hr/vacaciones.js';
import { horarioTexto, horasSemanales } from '../../../../domain/hr/horario.js';
import { TIPOS_EVENTO, tipoEvento } from '../../../../services/hr-events.service.js';

const pad = (n) => String(n).padStart(2, '0');
const f1 = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Resúmenes mensuales del año de un empleado + saldos de vacaciones y banco de horas. */
function analisisAnual(emp, year, meses, feriados) {
  const porMes = meses.map((days, i) => {
    const m = i + 1;
    return { m, r: resumenPeriodo(emp, `${year}-${pad(m)}-01`, `${year}-${pad(m)}-${pad(daysInMonth(year, m))}`, days, feriados) };
  });
  const sum = (k) => porMes.reduce((a, x) => a + x.r[k], 0);
  const vac = { correspondientes: emp.regimen === 'pasantia' ? 0 : diasVacaciones(emp.fechaIngreso, year), tomadas: sum('vacaciones') };
  vac.saldo = vac.correspondientes - vac.tomadas;
  const banco = { generadas: sum('bancoGen'), usadas: sum('bancoUsado') };
  banco.saldo = banco.generadas - banco.usadas;
  return { porMes, vac, banco, sum };
}

/** Vencimientos próximos (pasantía, contrato a plazo, novedades con fecha límite). */
export function vencimientos(emps, eventos, dias = 30, hoy = todayISO()) {
  const limite = new Date(Date.parse(`${hoy}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
  const out = [];
  emps.filter((e) => !e.fechaEgreso).forEach((e) => {
    if (e.fechaFin && e.fechaFin >= hoy && e.fechaFin <= limite) out.push({ emp: e, fecha: e.fechaFin, txt: e.regimen === 'pasantia' ? 'Finaliza la pasantía' : 'Vence el contrato' });
    if (e.fechaFin && e.fechaFin < hoy && !e.fechaEgreso) out.push({ emp: e, fecha: e.fechaFin, txt: e.regimen === 'pasantia' ? 'Pasantía vencida sin egreso registrado' : 'Contrato vencido sin egreso registrado', vencido: true });
  });
  eventos.filter((v) => v.vencimiento && v.vencimiento >= hoy && v.vencimiento <= limite).forEach((v) => {
    const emp = emps.find((e) => e.id === v.employeeId);
    if (emp && !emp.fechaEgreso) out.push({ emp, fecha: v.vencimiento, txt: v.titulo });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ============================ LISTADO ============================ */
async function mountLista(el, ctx) {
  const year = new Date().getFullYear();
  const [emps, eventos, ...meses] = await Promise.all([ctx.services.employees.list(), ctx.services.hrEvents.list(), ...Array.from({ length: 12 }, (_, i) => ctx.services.attendance.getMonth(year, i + 1))]);
  const feriados = feriadosDelAnio(year, ctx.state.settings.feriados);
  const activos = emps.filter((e) => !e.fechaEgreso).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const datos = activos.map((e) => ({ e, a: analisisAnual(e, year, meses.map((mm) => mm[e.id] || {}), feriados), ev: eventos.filter((x) => x.employeeId === e.id).length }));
  const venc = vencimientos(emps, eventos, 45);
  const f = { q: '', reg: '' };
  const pager = createPager({ onChange: () => rows() });

  el.innerHTML = html`
    <div class="page-head"><div><h2>Legajos de RR.HH.</h2><p>Antigüedad, vacaciones, banco de horas, pasantías y novedades de cada persona. Año ${year}.</p></div></div>
    ${venc.length ? html`<div class="alert alert-warning" style="margin-bottom:1.2rem"><i class="fas fa-bell"></i><div><strong>Vencimientos próximos (45 días)</strong>
      <ul style="margin:.3rem 0 0 1rem;list-style:disc">${venc.slice(0, 6).map((v) => html`<li><a href="#/rrhh?emp=${v.emp.id}">${v.emp.nombre}</a> — ${v.txt}: <b>${dateAR(v.fecha)}</b></li>`)}</ul></div></div>` : ''}
    <div class="card"><div class="card-body">
      <div class="toolbar"><div class="input-icon"><i class="fas fa-search lead"></i><input class="input" id="r-q" type="search" placeholder="Buscar por nombre, legajo o documento…"></div>
        <select class="select" id="r-reg"><option value="">Todo el personal</option><option value="dependencia">Relación de dependencia</option><option value="pasantia">Pasantes</option></select></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Persona</th><th>Antigüedad</th><th>Jornada</th><th class="num">Vacaciones ${year}</th><th class="num">Banco de horas</th><th class="num">Novedades</th><th></th></tr></thead>
        <tbody id="r-body"></tbody></table></div><div id="r-pager"></div></div></div>`;

  function rows() {
    const match = matcher(f.q);
    const list = datos.filter(({ e }) => match(e.nombre, e.dni, e.cuil, e.legajo, e.categoria) && (!f.reg || e.regimen === f.reg));
    const info = pager.apply(list);
    $('#r-pager', el).innerHTML = pager.view(info);
    $('#r-body', el).innerHTML = list.length ? info.rows.map(({ e, a, ev }) => {
      const ant = e.fechaIngreso <= todayISO() ? calcAntiguedad(e.fechaIngreso, todayISO()).texto : '—';
      return html`<tr>
        <td><strong>${e.nombre}</strong> ${e.regimen === 'pasantia' ? html`<span class="badge">Pasante</span>` : ''}<br><small class="muted-text">${[e.legajo && `Leg. ${e.legajo}`, e.categoria].filter(Boolean).join(' · ')}</small></td>
        <td>${ant}<br><small class="muted-text">Ingreso ${dateAR(e.fechaIngreso)}${e.fechaFin ? ` · fin ${dateAR(e.fechaFin)}` : ''}</small></td>
        <td><small>${horarioTexto(e.horario)}</small><br><small class="muted-text">${horasSemanales(e.horario)} hs/sem</small></td>
        <td class="num">${e.regimen === 'pasantia' ? '—' : html`<b>${a.vac.saldo}</b> <small class="muted-text">de ${a.vac.correspondientes} días</small>`}</td>
        <td class="num">${e.bancoHoras ? html`<b>${f1(a.banco.saldo)}</b> <small class="muted-text">hs</small>` : '—'}</td>
        <td class="num">${ev || '—'}</td>
        <td class="actions"><a class="btn btn-outline btn-sm" href="#/rrhh?emp=${e.id}"><i class="fas fa-id-card"></i> Legajo</a></td></tr>`;
    }).join('') : html`<tr><td colspan="7"><div class="empty"><i class="fas fa-id-card"></i><h4>Sin resultados</h4></div></td></tr>`;
  }
  pager.attach($('#r-pager', el)); rows();
  $('#r-q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; pager.reset(); rows(); }, 150));
  $('#r-reg', el).addEventListener('change', (e) => { f.reg = e.target.value; pager.reset(); rows(); });
}

/* ============================ LEGAJO ============================ */
async function mountLegajo(el, ctx, emp, year) {
  const [meses, eventos] = await Promise.all([ctx.services.attendance.getEmployeeYear(year, emp.id), ctx.services.hrEvents.listFor(emp.id)]);
  const feriados = feriadosDelAnio(year, ctx.state.settings.feriados);
  const a = analisisAnual(emp, year, meses, feriados);
  const pas = emp.regimen === 'pasantia';
  const ant = emp.fechaIngreso <= todayISO() ? calcAntiguedad(emp.fechaIngreso, emp.fechaEgreso && emp.fechaEgreso < todayISO() ? emp.fechaEgreso : todayISO()).texto : '—';
  const mesesPas = emp.fechaFin ? Math.round((daysBetween(parseISO(emp.fechaIngreso), parseISO(emp.fechaFin)) / 30.4) * 10) / 10 : null;
  const restan = emp.fechaFin ? Math.ceil(daysBetween(parseISO(todayISO()), parseISO(emp.fechaFin))) : null;
  let evs = eventos;

  const kv = (pairs) => html`<div class="kv">${pairs.filter(([, v]) => v).map(([k, v]) => html`<div><span>${k}</span><b>${v}</b></div>`)}</div>`;

  function drawEventos() {
    $('#ev-list', el).innerHTML = evs.length ? evs.map((v) => { const [, label, icon] = tipoEvento(v.tipo); return html`
      <li class="timeline-item"><i class="fas ${icon}"></i><div><strong>${v.titulo}</strong> <span class="badge badge-gray">${label}</span>
        <small class="muted-text" style="display:block">${dateAR(v.fecha)}${v.vencimiento ? ` · vence ${dateAR(v.vencimiento)}` : ''}</small>${v.detalle ? html`<p>${v.detalle}</p>` : ''}</div>
        <div><button class="icon-btn" data-ev-edit="${v.id}" title="Editar"><i class="fas fa-pen"></i></button><button class="icon-btn" data-ev-del="${v.id}" title="Eliminar"><i class="fas fa-trash"></i></button></div></li>`; })
      : html`<li class="empty" style="list-style:none"><i class="fas fa-clipboard-list"></i><h4>Sin novedades registradas</h4><p>Agregá sanciones, capacitaciones, exámenes médicos, cambios de categoría…</p></li>`;
  }

  el.innerHTML = html`
    <div class="page-head">
      <div><a class="back-home" href="#/rrhh"><i class="fas fa-arrow-left"></i> Legajos</a>
        <h2>${emp.nombre} ${pas ? html`<span class="badge">Pasante</span>` : ''}${emp.fechaEgreso ? html`<span class="badge badge-gray">Egresado ${dateAR(emp.fechaEgreso)}</span>` : html`<span class="badge badge-success">Activo</span>`}</h2>
        <p>${[emp.categoria, emp.legajo && `Legajo ${emp.legajo}`].filter(Boolean).join(' · ') || 'Legajo digital'}</p></div>
      <div class="page-actions"><a class="btn btn-outline" href="#/asistencia?emp=${emp.id}"><i class="fas fa-user-clock"></i> Asistencia</a>
        <button class="btn btn-primary" data-action="ev-new"><i class="fas fa-plus"></i> Nueva novedad</button></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:1.2rem;align-items:start">
      <div class="card"><div class="card-header"><h3>Datos laborales</h3></div><div class="card-body">${kv([
        ['Fecha de ingreso', dateAR(emp.fechaIngreso)], ['Antigüedad', ant], ['DNI', emp.dni], ['CUIL', emp.cuil], ['Convenio / categoría', emp.categoria],
        ['Jornada pactada', `${horarioTexto(emp.horario)} (${horasSemanales(emp.horario)} hs/sem)`], ['Banco de horas', emp.bancoHoras ? 'Sí (pactado por escrito)' : 'No'],
        [pas ? 'Asignación estímulo' : 'Remuneración', money(emp.sueldo)], ['Domicilio', emp.domicilio], ['Teléfono', emp.telefono], ['Correo', emp.email], ['Nacimiento', emp.fechaNac && dateAR(emp.fechaNac)]])}</div></div>
      ${pas ? html`<div class="card"><div class="card-header"><h3>Pasantía educativa (Ley 26.427)</h3></div><div class="card-body">${kv([
        ['Institución educativa', emp.institucion], ['Carrera', emp.carrera], ['Convenio marco', emp.convenioMarco], ['Tutor institucional', emp.tutorInst], ['Tutor de la empresa', emp.tutorEmpresa],
        ['Inicio', dateAR(emp.fechaIngreso)], ['Fin previsto', emp.fechaFin && dateAR(emp.fechaFin)], ['Duración', mesesPas && `${mesesPas} meses (mín. 2, máx. 12; prórroga hasta 6 más)`],
        ['Tiempo restante', restan != null && (restan >= 0 ? `${restan} días` : 'Vencida')], ['Carga semanal', `${horasSemanales(emp.horario)} hs (máx. 20)`]])}
        <div class="alert alert-info" style="margin-top:.8rem"><i class="fas fa-circle-info"></i><div>La pasantía no genera relación laboral: la asignación es no remunerativa y no corresponden vacaciones ni SAC. Cubrila con obra social y ART.</div></div></div></div>`
      : html`<div class="card"><div class="card-header"><h3>Vacaciones ${year}</h3>
          <div class="seg"><a class="btn btn-ghost btn-sm" href="#/rrhh?emp=${emp.id}&y=${year - 1}">‹ ${year - 1}</a><a class="btn btn-ghost btn-sm" href="#/rrhh?emp=${emp.id}&y=${year + 1}">${year + 1} ›</a></div></div>
        <div class="card-body"><div class="grid grid-3" style="gap:.8rem">
          <div class="mini"><small>Corresponden</small><strong>${a.vac.correspondientes}</strong></div><div class="mini"><small>Tomadas</small><strong>${a.vac.tomadas}</strong></div><div class="mini ${a.vac.saldo < 0 ? 'neg' : 'pos'}"><small>Saldo</small><strong>${a.vac.saldo}</strong></div></div>
          <p class="muted-text" style="font-size:.82rem;margin-top:.8rem">Días corridos según antigüedad al 31/12 (art. 150 LCT). La Ley 27.802 permite fraccionar las vacaciones en tramos de al menos 7 días corridos, con goce entre el 1/10 y el 30/04 (o fuera de temporada por acuerdo).</p>
          ${emp.bancoHoras ? html`<div class="grid grid-3" style="gap:.8rem;margin-top:.8rem"><div class="mini"><small>Horas al banco</small><strong>${f1(a.banco.generadas)}</strong></div><div class="mini"><small>Horas usadas</small><strong>${f1(a.banco.usadas)}</strong></div><div class="mini ${a.banco.saldo < 0 ? 'neg' : 'pos'}"><small>Saldo de horas</small><strong>${f1(a.banco.saldo)}</strong></div></div>` : ''}</div></div>`}
    </div>

    <div class="grid grid-2" style="grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start">
      <div class="card"><div class="card-header"><h3>Asistencia ${year} mes a mes</h3></div><div class="table-wrap"><table class="table">
        <thead><tr><th>Mes</th><th class="num">Días</th><th class="num">Horas</th><th class="num">Extras</th><th class="num">F. inj.</th><th class="num">Licenc.</th></tr></thead>
        <tbody>${a.porMes.map(({ m, r }) => html`<tr><td><a href="#/asistencia?emp=${emp.id}&y=${year}&m=${m}">${MESES[m - 1]}</a></td><td class="num">${r.diasTrab || '—'}</td><td class="num">${r.hsTrab ? f1(r.hsTrab) : '—'}</td>
          <td class="num">${r.he50 + r.he100 + r.bancoGen ? f1(r.he50 + r.he100 + r.bancoGen) : '—'}</td><td class="num">${r.faltasInj || '—'}</td><td class="num">${r.licencias || '—'}</td></tr>`)}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${a.sum('diasTrab')}</td><td class="num">${f1(a.sum('hsTrab'))}</td><td class="num">${f1(a.sum('he50') + a.sum('he100') + a.sum('bancoGen'))}</td><td class="num">${a.sum('faltasInj')}</td><td class="num">${a.sum('licencias')}</td></tr></tfoot></table></div></div>
      <div class="card"><div class="card-header"><h3>Novedades del legajo</h3></div><div class="card-body"><ul class="timeline" id="ev-list"></ul></div></div>
    </div>`;
  drawEventos();

  function eventoDialog(ev) {
    const body = document.createElement('div');
    body.innerHTML = html`<form id="evf" class="form-grid" novalidate>
      <div class="field"><label>Fecha *</label><input class="input" type="date" name="fecha" value="${ev?.fecha || todayISO()}"><span class="error" data-error="fecha"></span></div>
      <div class="field"><label>Tipo</label><select class="select" name="tipo">${TIPOS_EVENTO.map(([id, label]) => html`<option value="${id}" ${ev?.tipo === id ? 'selected' : ''}>${label}</option>`)}</select></div>
      <div class="field full"><label>Título *</label><input class="input" name="titulo" maxlength="120" value="${ev?.titulo || ''}" placeholder="Ej: Curso de seguridad e higiene"><span class="error" data-error="titulo"></span></div>
      <div class="field full"><label>Detalle</label><textarea class="textarea" name="detalle" rows="3" maxlength="1000">${ev?.detalle || ''}</textarea></div>
      <div class="field full"><label>Fecha de vencimiento (opcional)</label><input class="input" type="date" name="vencimiento" value="${ev?.vencimiento || ''}"><span class="hint">Aparece como aviso en el panel antes de vencer (examen médico, certificado, contrato…).</span></div></form>`;
    const footer = document.createElement('div'); footer.className = 'modal-actions';
    footer.innerHTML = '<button type="button" class="btn btn-ghost" data-c>Cancelar</button><button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>';
    const m = ctx.openModal({ title: ev ? 'Editar novedad' : 'Nueva novedad', body, footer });
    footer.querySelector('[data-c]').onclick = m.close;
    footer.querySelector('[data-s]').onclick = async (e) => {
      const btn = e.currentTarget; btn.setAttribute('aria-busy', 'true');
      body.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
      try {
        const saved = await ctx.services.hrEvents.save({ ...readForm($('#evf', body)), employeeId: emp.id, id: ev?.id });
        evs = (ev ? evs.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...evs]).sort((a2, b2) => b2.fecha.localeCompare(a2.fecha));
        drawEventos(); m.close(); ctx.toast('Novedad guardada', 'success');
      } catch (err) {
        if (err.errors) Object.entries(err.errors).forEach(([k, msg]) => { const s = body.querySelector(`[data-error="${k}"]`); if (s) s.textContent = msg; });
        else ctx.toast('No se pudo guardar.', 'error');
      } finally { btn.removeAttribute('aria-busy'); }
    };
  }
  on(el, 'click', '[data-action="ev-new"]', () => eventoDialog(null));
  on(el, 'click', '[data-ev-edit]', (_, b) => eventoDialog(evs.find((x) => x.id === b.dataset.evEdit)));
  on(el, 'click', '[data-ev-del]', async (_, b) => {
    if (!(await ctx.confirmDialog({ title: 'Eliminar novedad', message: 'Se eliminará del legajo.', confirmText: 'Eliminar', danger: true }))) return;
    await ctx.services.hrEvents.remove(b.dataset.evDel); evs = evs.filter((x) => x.id !== b.dataset.evDel); drawEventos(); ctx.toast('Novedad eliminada', 'success');
  });
}

export default {
  id: 'rrhh', title: 'Legajos', icon: 'fa-id-card', group: 'Recursos Humanos',
  async mount(el, ctx, params) {
    const id = params.get('emp');
    if (!id) return mountLista(el, ctx);
    const emp = await ctx.services.employees.get(id);
    if (!emp) { el.innerHTML = html`<div class="card"><div class="card-body empty"><h4>No encontramos al empleado</h4><a class="btn btn-primary" href="#/rrhh" style="margin-top:1rem">Volver</a></div></div>`; return; }
    return mountLegajo(el, ctx, emp, Number(params.get('y')) || new Date().getFullYear());
  },
};
