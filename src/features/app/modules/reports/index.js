import { html } from '../../../../core/html.js';
import { $, on } from '../../../../core/dom.js';
import { money, moneyCompact, mesNombre } from '../../../../core/format.js';
import { dcard, iconLead } from '../../../../core/ui/cards.js';
import { statValue } from '../../../../core/ui/stat.js';
import { downloadPayslipsPDF, downloadPayrollSummaryPDF } from '../../../../services/pdf/index.js';
import { exportNominaXLSX, exportPagosCSV } from '../payroll/export.js';

const bars = (data, key) => {
  const max = Math.max(...data.map((d) => d[key]), 1);
  return html`<div class="chart dense">${data.map((m) => html`<div class="col" title="${money(m[key])}"><em>${m[key] ? moneyCompact(m[key]) : ''}</em><div class="bar ${m[key] ? '' : 'zero'}" style="height:${Math.max(3, (m[key] / max) * 100)}%"></div><span>${m.label}</span></div>`)}</div>`;
};

const hbars = (rows) => {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return html`<div class="hbars">${rows.map((r) => html`<div class="hb"><span>${r.k}</span><div class="progress"><i style="width:${(r.v / max) * 100}%"></i></div><b>${money(r.v)}</b></div>`)}</div>`;
};

export default {
  id: 'reportes', title: 'Reportes', icon: 'fa-chart-column', group: 'Principal',

  async mount(el, ctx) {
    const [runs, emps] = await Promise.all([ctx.services.payroll.list(), ctx.services.employees.list()]);
    const done = runs.filter((r) => r.estado !== 'borrador');
    const year = new Date().getFullYear();
    const monthly = Array.from({ length: 12 }, (_, i) => ({ label: mesNombre(i + 1).slice(0, 3), neto: 0, costo: 0, desc: 0 }));
    for (const r of done) {
      if (r.tipo === 'sac' || !r.desde.startsWith(String(year))) continue;
      const m = monthly[+r.desde.slice(5, 7) - 1];
      m.neto += r.totals.neto; m.costo += r.totals.costo; m.desc += r.totals.descuentos;
    }
    const ytd = done.filter((r) => r.desde.startsWith(String(year)));
    const sum = (k) => ytd.reduce((a, r) => a + (r.totals[k] || 0), 0);
    // Distribución por categoría (última nómina)
    const last = done[0];
    const porCat = {};
    last?.lines.forEach((l) => { const k = l.categoria || 'Sin categoría'; porCat[k] = (porCat[k] || 0) + l.totals.neto; });
    const catRows = Object.entries(porCat).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 6);
    const activos = emps.filter((e) => !e.fechaEgreso).length;
    const prom = last && last.totals.empleados ? last.totals.neto / last.totals.empleados : 0;

    el.innerHTML = html`
      <div class="page-head"><div><h2>Reportes y estadísticas</h2><p>Costo laboral, neto pagado y descargas del año ${year}.</p></div></div>
      <div class="grid grid-4 mb">
        <div class="card stat"><div class="ico blue"><i class="fas fa-users"></i></div><div><strong>${activos}</strong><small>Empleados activos</small></div></div>
        <div class="card stat"><div class="ico green"><i class="fas fa-money-check-dollar"></i></div><div>${statValue(money(sum('neto')))}<small>Neto liquidado ${year}</small></div></div>
        <div class="card stat"><div class="ico violet"><i class="fas fa-building"></i></div><div>${statValue(money(sum('costo')))}<small>Costo laboral ${year}</small></div></div>
        <div class="card stat"><div class="ico amber"><i class="fas fa-user-tag"></i></div><div>${statValue(money(prom))}<small>Neto promedio / empleado</small></div></div>
      </div>
      <div class="grid grid-split">
        <div class="card">
          <div class="card-header"><h3>Evolución mensual ${year}</h3>
            <div class="seg"><button class="active" data-m="costo">Costo laboral</button><button data-m="neto">Neto</button><button data-m="desc">Descuentos</button></div></div>
          <div class="card-body" id="rp-chart">${bars(monthly, 'costo')}</div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Neto por categoría${last ? ' · ' + last.label : ''}</h3></div>
          <div class="card-body">${catRows.length ? hbars(catRows) : html`<div class="empty"><i class="fas fa-chart-pie"></i><p>Sin datos todavía.</p></div>`}</div>
        </div>
      </div>
      <div class="card" style="margin-top:1.2rem">
        <div class="card-header"><h3>Descargas por nómina</h3></div>
        <div class="card-body">
          ${done.length ? html`<div class="table-wrap has-cards"><table class="table"><thead><tr><th>Período</th><th class="num">Empleados</th><th class="num">Neto</th><th class="actions">Descargar</th></tr></thead>
            <tbody>${done.slice(0, 12).map((r) => html`<tr><td><strong>${r.label}</strong></td><td class="num">${r.totals.empleados}</td><td class="num">${money(r.totals.neto)}</td>
              <td class="actions"><div class="row-actions">
                <button class="btn btn-outline btn-sm" data-dl="resumen" data-id="${r.id}"><i class="fas fa-file-pdf"></i> Resumen PDF</button>
                <button class="btn btn-outline btn-sm" data-dl="recibos" data-id="${r.id}"><i class="fas fa-file-lines"></i> Recibos</button>
                <button class="btn btn-outline btn-sm" data-dl="xlsx" data-id="${r.id}"><i class="fas fa-file-excel"></i> Excel</button>
                <button class="btn btn-outline btn-sm" data-dl="csv" data-id="${r.id}"><i class="fas fa-file-csv"></i> Pagos</button></div></td></tr>`)}</tbody></table></div>
          <div class="cards-list">${done.slice(0, 12).map((r) => dcard({
            lead: iconLead('fa-file-pdf', 'violet'), title: r.label, sub: `${r.totals.empleados} empleados`,
            rows: [['fa-sack-dollar', 'Neto liquidado', money(r.totals.neto), 'hl wide']],
            actions: html`<div class="dl-grid"><button class="btn btn-outline btn-sm" data-dl="resumen" data-id="${r.id}"><i class="fas fa-file-pdf"></i> Resumen PDF</button>
              <button class="btn btn-outline btn-sm" data-dl="recibos" data-id="${r.id}"><i class="fas fa-file-lines"></i> Recibos</button>
              <button class="btn btn-outline btn-sm" data-dl="xlsx" data-id="${r.id}"><i class="fas fa-file-excel"></i> Excel</button>
              <button class="btn btn-outline btn-sm" data-dl="csv" data-id="${r.id}"><i class="fas fa-file-csv"></i> Pagos</button></div>`,
          }))}</div>`
            : html`<div class="empty"><i class="fas fa-file-pdf"></i><h4>Sin nóminas liquidadas</h4><p>Los reportes aparecen cuando liquidás una nómina.</p></div>`}
        </div>
      </div>`;

    on(el, 'click', '[data-m]', (_, b) => {
      el.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('active', x === b));
      $('#rp-chart', el).innerHTML = bars(monthly, b.dataset.m);
    });
    on(el, 'click', '[data-dl]', async (_, b) => {
      const run = done.find((r) => r.id === b.dataset.id), est = ctx.state.settings.estudio, k = b.dataset.dl;
      b.setAttribute('aria-busy', 'true');
      try {
        if (k === 'resumen') await downloadPayrollSummaryPDF(run, est, ctx.user.name);
        if (k === 'recibos') await downloadPayslipsPDF(run, run.lines, est, ctx.user.name);
        if (k === 'xlsx') await exportNominaXLSX(run);
        if (k === 'csv') exportPagosCSV(run);
      } catch { ctx.toast('No se pudo generar el archivo. Revisá tu conexión.', 'error'); }
      finally { b.removeAttribute('aria-busy'); }
    });
  },
};
