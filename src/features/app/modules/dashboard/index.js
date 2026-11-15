import { html } from '../../../../core/html.js';
import { $, on } from '../../../../core/dom.js';
import { money, moneyCompact, dateAR, dateTimeAR, mesNombre } from '../../../../core/format.js';
import { motivoLabel } from '../../../../domain/legal/params.js';
import { statValue } from '../../../../core/ui/stat.js';
import { APP } from '../../../../config/app.config.js';

function buildAlerts(ctx, emps, liqs, runs) {
  const out = [];
  if (ctx.user.isDemo) out.push(['warning', 'Estás en modo demo: los datos se guardan solo en este navegador. Configurá Firebase para sincronizar en la nube.']);
  if (!emps.length) out.push(['info', 'Todavía no cargaste empleados. Sumá el primero o importá tu planilla de Excel.']);
  const hoy = new Date();
  const vencidas = runs.filter((r) => r.estado === 'liquidada' && r.fechaPago && r.fechaPago < hoy.toISOString().slice(0, 10));
  if (vencidas.length) out.push(['warning', `${vencidas.length} nómina(s) con pagos pendientes y fecha de pago vencida: ${vencidas.slice(0, 2).map((r) => r.label).join(', ')}.`]);
  const borradores = runs.filter((r) => r.estado === 'borrador').length;
  if (borradores) out.push(['info', `${borradores} nómina(s) en borrador pendientes de liquidar.`]);
  const sinCbu = emps.filter((e) => !e.fechaEgreso && !e.cbu).length;
  if (emps.length && sinCbu) out.push(['info', `${sinCbu} empleado(s) activos sin CBU cargado (necesario para transferencias).`]);
  const sinLiquidar = emps.filter((e) => e.fechaEgreso && !liqs.some((l) => l.employeeId === e.id));
  if (sinLiquidar.length) out.push(['warning', `${sinLiquidar.length} empleado(s) con egreso sin liquidación final guardada.`]);
  if (!ctx.state.settings.estudio.razonSocial) out.push(['info', 'Completá los datos de tu estudio/empresa en Configuración para que aparezcan en los recibos.']);
  out.push(['info', `Marco legal aplicado: Ley 27.802 de Modernización Laboral. Última revisión: ${APP.legalRevision}.`]);
  return out;
}

const bars = (data, max) => html`
  <div class="chart" role="img" aria-label="Gráfico de barras por mes">
    ${data.map((m) => html`<div class="col" title="${m.count} registro(s)"><em>${m.total ? moneyCompact(m.total) : ''}</em>
      <div class="bar ${m.total ? '' : 'zero'}" style="height:${Math.max(3, (m.total / max) * 100)}%"></div><span>${m.label}</span></div>`)}
  </div>`;

function nominaPorMes(runs) {
  const base = new Date(), map = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    map.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { label: mesNombre(d.getMonth() + 1).slice(0, 3), total: 0, count: 0 });
  }
  for (const r of runs) {
    if (r.tipo === 'sac' || r.estado === 'borrador') continue;
    const k = r.desde.slice(0, 7);
    if (map.has(k)) { const m = map.get(k); m.total += r.totals.costo; m.count += 1; }
  }
  return [...map.values()];
}

export default {
  id: 'dashboard', title: 'Inicio', icon: 'fa-gauge-high', group: 'Principal',

  async mount(el, ctx) {
    const [emps, liqs, runs] = await Promise.all([ctx.services.employees.list(), ctx.services.liquidations.list(), ctx.services.payroll.list()]);
    const st = ctx.services.liquidations.stats(liqs);
    const activos = emps.filter((e) => !e.fechaEgreso).length;
    const pendiente = runs.filter((r) => r.estado === 'liquidada').reduce((a, r) => a + r.totals.pendiente, 0);
    const ultRun = runs.find((r) => r.estado !== 'borrador');
    const nom = nominaPorMes(runs);
    const maxN = Math.max(...nom.map((m) => m.total), 1), maxL = Math.max(...st.porMes.map((m) => m.total), 1);

    el.innerHTML = html`
      <div class="page-head">
        <div><h2>Inicio</h2><p>Resumen de liquidaciones, pagos y estadísticas.</p></div>
        <div class="page-actions">
          <a class="btn btn-outline" href="#/empleados"><i class="fas fa-user-plus"></i> Empleados</a>
          <a class="btn btn-outline" href="#/pagos"><i class="fas fa-credit-card"></i> Pagos</a>
          <a class="btn btn-outline" href="#/reportes"><i class="fas fa-chart-column"></i> Reportes</a>
          <a class="btn btn-outline" href="#/simulador"><i class="fas fa-calculator"></i> Liquidación final</a>
          <a class="btn btn-primary" href="#/nomina"><i class="fas fa-money-check-dollar"></i> Nómina</a>
        </div>
      </div>

      <div class="grid grid-4 mb">
        <div class="card stat"><div class="ico violet"><i class="fas fa-users"></i></div><div><small>Empleados activos</small><strong>${activos}</strong></div></div>
        <div class="card stat"><div class="ico green"><i class="fas fa-money-check-dollar"></i></div><div><small>Última nómina${ultRun ? ' · ' + ultRun.label : ''}</small>${statValue(ultRun ? money(ultRun.totals.neto) : '—')}</div></div>
        <div class="card stat"><div class="ico amber"><i class="fas fa-hourglass-half"></i></div><div><small>Pendiente de pago</small>${statValue(money(pendiente))}</div></div>
        <div class="card stat"><div class="ico blue"><i class="fas fa-file-invoice-dollar"></i></div><div><small>Liquidaciones finales (${st.count})</small>${statValue(money(st.totalNeto))}</div></div>
      </div>

      <div class="grid grid-split">
        <div class="card">
          <div class="card-header"><h3>Evolución — últimos 6 meses</h3>
            <div class="seg" role="tablist"><button class="active" data-tab="nomina">Costo de nómina</button><button data-tab="finales">Liquidaciones finales</button></div></div>
          <div class="card-body" id="chart-box">${bars(nom, maxN)}</div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Avisos</h3></div>
          <div class="card-body" style="display:grid;gap:.7rem">
            ${buildAlerts(ctx, emps, liqs, runs).map(([t, m]) => html`<div class="alert alert-${t}"><i class="fas ${t === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i><div>${m}</div></div>`)}
          </div>
        </div>
      </div>

      <div class="grid grid-even" style="margin-top:1.2rem">
        <div class="card">
          <div class="card-header"><h3>Últimas nóminas</h3><a class="btn btn-ghost btn-sm" href="#/nomina">Ver todas</a></div>
          <div class="card-body">
            ${runs.length ? html`<ul class="list-plain">${runs.slice(0, 5).map((r) => html`
              <li><div class="t"><strong>${r.label}</strong><small>${r.totals.empleados} empleados · ${r.estado === 'pagada' ? 'Pagada' : r.estado === 'borrador' ? 'Borrador' : 'Pago pendiente'}</small></div>
              <div style="display:flex;gap:.8rem;align-items:center"><b>${money(r.totals.neto)}</b><a class="icon-btn" href="#/nomina?id=${r.id}"><i class="fas fa-folder-open"></i></a></div></li>`)}</ul>`
              : html`<div class="empty"><i class="fas fa-money-check-dollar"></i><h4>Sin nóminas</h4><p>Creá la primera desde Nómina.</p></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Últimas liquidaciones finales</h3><a class="btn btn-ghost btn-sm" href="#/historial">Ver todo</a></div>
          <div class="card-body">
            ${liqs.length ? html`<ul class="list-plain">${liqs.slice(0, 5).map((l) => html`
              <li><div class="t"><strong>${l.employeeName}</strong><small>${motivoLabel(l.input.motivo)} · ${dateTimeAR(l.createdAt)}</small></div>
              <div style="display:flex;gap:.8rem;align-items:center"><b>${money(l.totals.neto)}</b><a class="icon-btn" href="#/recibos?id=${l.id}"><i class="fas fa-file-lines"></i></a></div></li>`)}</ul>`
              : html`<div class="empty"><i class="fas fa-folder-open"></i><h4>Sin liquidaciones</h4><p>Guardá tu primer cálculo desde el simulador.</p></div>`}
          </div>
        </div>
      </div>`;

    on(el, 'click', '[data-tab]', (_, b) => {
      el.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
      $('#chart-box', el).innerHTML = b.dataset.tab === 'nomina' ? bars(nom, maxN) : bars(st.porMes, maxL);
    });
  },
};
