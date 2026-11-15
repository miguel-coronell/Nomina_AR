import { html } from '../../../../core/html.js';
import { $, on, debounce } from '../../../../core/dom.js';
import { matcher } from '../../../../core/search.js';
import { verificarPin } from '../../../../core/pin.js';
import { feriadosDelAnio } from '../../../../domain/hr/feriados.js';
import { horasDe, intervalos, turnoAbierto, aMinutos, horaActual, marcacionesTexto } from '../../../../domain/hr/horas.js';
import { horasPactadas } from '../../../../domain/hr/horario.js';

const pad = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hs = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
const FECHA = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Horas del día incluyendo el turno abierto hasta "ahora" (para el tablero en vivo). */
function horasVivo(rec, emp, ahoraMin) {
  const cerradas = horasDe(rec, emp?.descansoMin);
  if (!turnoAbierto(rec)) return cerradas;
  const ini = aMinutos(rec.i[rec.i.length - 1][0]);
  const d = ahoraMin - ini;
  return cerradas + (d < 0 ? d + 1440 : d) / 60;
}

export default {
  id: 'fichaje', title: 'Fichaje', icon: 'fa-fingerprint', group: 'Recursos Humanos',

  async mount(el, ctx) {
    const emps = (await ctx.services.employees.list()).filter((e) => !e.fechaEgreso).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const porId = new Map(emps.map((e) => [e.id, e]));
    let hoy = await ctx.services.attendance.hoy();
    let elegido = null, q = '';
    const fallos = new Map();   // empId → { n, hasta }
    let aviso = null, timerAviso;

    el.innerHTML = html`
      <div class="page-head"><div><h2>Fichaje de entrada y salida</h2><p>Cada persona marca con su PIN. Las horas se calculan solas y pasan a la nómina y al recibo.</p></div>
        <div class="page-actions"><button class="btn btn-outline" data-action="fs"><i class="fas fa-expand"></i> Pantalla completa</button></div></div>
      <div class="clock-layout">
        <div class="card clock-card"><div class="card-body">
          <div class="clock-time" id="ck-time">--:--:--</div><div class="clock-date" id="ck-date"></div>
          <div id="ck-aviso"></div>
          <div class="input-icon" style="margin-top:1.2rem"><i class="fas fa-search lead"></i><input class="input" id="ck-q" type="search" placeholder="Buscá tu nombre, legajo o DNI…" autocomplete="off"></div>
          <div id="ck-lista" class="ck-lista"></div>
          <div id="ck-panel"></div>
          <p class="muted-text" style="font-size:.76rem;margin-top:1rem"><i class="fas fa-clock"></i> Se usa la hora de este dispositivo. Dejá este puesto de fichaje con la sesión iniciada en un equipo de la empresa.</p>
        </div></div>
        <div class="card"><div class="card-header"><h3>Hoy <span class="badge" id="ck-pres">0 presentes</span></h3></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Persona</th><th>Marcaciones</th><th class="num">Horas</th><th>Estado</th></tr></thead><tbody id="ck-hoy"></tbody></table></div>
          <div class="card-footer" id="ck-sin"></div></div>
      </div>`;

    const reloj = () => { const d = new Date(); $('#ck-time', el).textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; $('#ck-date', el).textContent = FECHA.format(d); };
    reloj();
    const tic = setInterval(() => { reloj(); if (new Date().getSeconds() === 0) tablero(); }, 1000);

    function tablero() {
      const ahora = new Date(), min = ahora.getHours() * 60 + ahora.getMinutes();
      const filas = Object.entries(hoy).map(([id, { rec }]) => ({ e: porId.get(id), rec })).filter((x) => x.e)
        .sort((a, b) => Number(turnoAbierto(b.rec)) - Number(turnoAbierto(a.rec)) || a.e.nombre.localeCompare(b.e.nombre, 'es'));
      const presentes = filas.filter((f) => turnoAbierto(f.rec)).length;
      $('#ck-pres', el).textContent = `${presentes} presente${presentes === 1 ? '' : 's'}`;
      $('#ck-hoy', el).innerHTML = filas.length ? filas.map(({ e, rec }) => html`<tr>
        <td><strong>${e.nombre}</strong></td><td><small>${marcacionesTexto(rec)}</small></td><td class="num">${hs(horasVivo(rec, e, min))} h</td>
        <td>${turnoAbierto(rec) ? html`<span class="badge badge-success">Presente</span>` : html`<span class="badge badge-gray">Salió</span>`}</td></tr>`).join('')
        : html`<tr><td colspan="4"><div class="empty"><i class="fas fa-fingerprint"></i><h4>Todavía no hay fichajes hoy</h4></div></td></tr>`;
      const f = feriadosDelAnio(ahora.getFullYear(), ctx.state.settings.feriados).get(isoLocal(ahora));
      const sin = emps.filter((e) => !hoy[e.id] && horasPactadas(e.horario, isoLocal(ahora)) > 0 && f?.tipo !== 'feriado' && e.fechaIngreso <= isoLocal(ahora));
      $('#ck-sin', el).innerHTML = html`${f ? html`<span class="badge ${f.tipo === 'feriado' ? 'badge-danger' : 'badge-warning'}">${f.tipo === 'feriado' ? 'Feriado' : 'No laborable'}: ${f.nombre}</span> ` : ''}<small class="muted-text">${sin.length ? `Sin fichar todavía (${sin.length}): ${sin.slice(0, 6).map((e) => e.nombre.split(',')[0]).join(', ')}${sin.length > 6 ? '…' : ''}` : 'Todos los que tienen jornada hoy ya fichó.'}</small>`;
    }

    function lista() {
      const match = matcher(q);
      const r = q ? emps.filter((e) => match(e.nombre, e.dni, e.legajo, e.cuil)).slice(0, 6) : [];
      $('#ck-lista', el).innerHTML = r.map((e) => html`<button class="ck-emp ${elegido?.id === e.id ? 'active' : ''}" data-emp="${e.id}"><i class="fas fa-user"></i><span>${e.nombre}<small>${[e.legajo && `Leg. ${e.legajo}`, e.categoria].filter(Boolean).join(' · ')}</small></span></button>`).join('')
        || (q ? html`<div class="muted-text" style="padding:.6rem">Sin coincidencias.</div>` : '');
    }

    function panel() {
      const p = $('#ck-panel', el);
      if (!elegido) { p.innerHTML = ''; return; }
      const reg = hoy[elegido.id]?.rec;
      const abierto = reg && turnoAbierto(reg);
      const conPin = !!elegido.pinHash;
      p.innerHTML = html`<div class="ck-sel">
        <h3>${elegido.nombre}</h3>
        <small class="muted-text">${reg ? `Hoy: ${marcacionesTexto(reg)}` : 'Hoy todavía no fichaste.'}</small>
        ${conPin ? html`<input class="input ck-pin" id="ck-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="PIN">`
          : html`<div class="alert alert-warning" style="margin:.8rem 0"><i class="fas fa-triangle-exclamation"></i><div>Esta persona no tiene PIN. Configuralo en su ficha (Empleados → Editar).</div></div>`}
        <button class="btn ${abierto ? 'btn-danger' : 'btn-primary'} btn-lg btn-block" data-action="punch"><i class="fas ${abierto ? 'fa-right-from-bracket' : 'fa-right-to-bracket'}"></i> Registrar ${abierto ? 'SALIDA' : 'ENTRADA'}</button></div>`;
      $('#ck-pin', el)?.focus();
    }

    function avisar(tipo, msg) {
      clearTimeout(timerAviso);
      $('#ck-aviso', el).innerHTML = html`<div class="ck-aviso ${tipo}">${msg}</div>`;
      timerAviso = setTimeout(() => { $('#ck-aviso', el).innerHTML = ''; }, 7000);
    }

    $('#ck-q', el).addEventListener('input', debounce((e) => { q = e.target.value; lista(); }, 120));
    on(el, 'click', '[data-emp]', (_, b) => { elegido = porId.get(b.dataset.emp); lista(); panel(); });
    on(el, 'click', '[data-action="fs"]', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'ck-pin') $('[data-action="punch"]', el).click(); });

    on(el, 'click', '[data-action="punch"]', async (_, btn) => {
      if (!elegido) return;
      const emp = elegido;
      if (!emp.pinHash) return avisar('err', 'Configurá primero un PIN para esta persona.');
      const bloqueo = fallos.get(emp.id);
      if (bloqueo?.hasta > Date.now()) return avisar('err', `Demasiados intentos. Esperá ${Math.ceil((bloqueo.hasta - Date.now()) / 1000)} segundos.`);
      const pin = $('#ck-pin', el).value;
      if (!(await verificarPin(emp, pin))) {
        const n = (bloqueo?.n || 0) + 1;
        fallos.set(emp.id, { n, hasta: n >= 3 ? Date.now() + 30000 : 0 });
        $('#ck-pin', el).value = '';
        return avisar('err', n >= 3 ? 'PIN incorrecto. Bloqueado 30 segundos.' : `PIN incorrecto (${n}/3).`);
      }
      fallos.delete(emp.id);
      btn.setAttribute('aria-busy', 'true');
      try {
        const r = await ctx.services.attendance.punch(emp.id, new Date());
        hoy = await ctx.services.attendance.hoy();
        const horas = horasDe(r.rec, emp.descansoMin);
        avisar('ok', html`<i class="fas ${r.tipo === 'entrada' ? 'fa-right-to-bracket' : 'fa-circle-check'}"></i> <b>${emp.nombre}</b><br>${r.tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada a las <b>${r.hora}</b>${r.tipo === 'salida' ? html` · hoy trabajaste <b>${hs(horas)} h</b>` : ''}`);
        elegido = null; q = ''; $('#ck-q', el).value = ''; lista(); panel(); tablero();
      } catch (e) {
        avisar('err', ['OTRO_REGISTRO', 'HORAS_MANUALES', 'DOBLE'].includes(e.code) ? e.message : 'No se pudo registrar. Intentá de nuevo.');
        if (!['OTRO_REGISTRO', 'HORAS_MANUALES', 'DOBLE'].includes(e.code)) console.error(e);
      } finally { btn.removeAttribute('aria-busy'); }
    });

    tablero(); lista();
    return () => { clearInterval(tic); clearTimeout(timerAviso); };
  },
};
