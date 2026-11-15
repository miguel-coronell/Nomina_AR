import { html } from '../../../../core/html.js';
import { $, on, readForm, num } from '../../../../core/dom.js';
import { downloadFile } from '../../../../core/csv.js';
import { dateTimeAR } from '../../../../core/format.js';
import { PLANS } from '../../../../config/plans.config.js';
import { ROUTES } from '../../../../config/app.config.js';
import { authMode, updateDisplayName } from '../../../../services/auth.service.js';
import { ESTILOS_GRAFICO } from '../../../../domain/payroll/costo.js';
import { fileToLogo } from '../../../../core/image.js';
import { DEFAULT_SETTINGS } from '../../../../services/settings.service.js';
import { DEFAULT_TEMPLATES, PLACEHOLDERS } from '../../../../services/share.service.js';

const logoPreview = (logo) => (logo?.data ? html`<img src="${logo.data}" alt="Logo cargado">` : html`<span class="muted-text"><i class="fas fa-image"></i> Sin logo</span>`);
const numField = (label, name, value, hint = '') => html`
  <div class="field"><label>${label}</label><input class="input" type="number" step="0.01" min="0" name="${name}" value="${value}">${hint ? html`<span class="hint">${hint}</span>` : ''}</div>`;

export default {
  id: 'configuracion', title: 'Configuración', icon: 'fa-gear', group: 'Cuenta',

  async mount(el, ctx) {
    const s = ctx.state.settings;
    const p = ctx.state.profile;
    const plan = ctx.plan;

    el.innerHTML = html`
      <div class="page-head"><div><h2>Configuración</h2><p>Parámetros de cálculo, datos del emisor y cuenta.</p></div></div>
      <div class="settings-grid">
        <div style="display:grid;gap:1.2rem">
          <form class="card" id="f-estudio"><div class="card-header"><h3>Datos del empleador (se imprimen en los recibos)</h3></div>
            <div class="card-body form-grid">
              <div class="field full"><label>Logo de la empresa / estudio</label>
                <div class="logo-box">
                  <div class="logo-preview" id="logo-preview">${logoPreview(s.estudio.logo)}</div>
                  <div class="logo-actions">
                    <input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp" hidden>
                    <button type="button" class="btn btn-outline btn-sm" data-action="logo-pick"><i class="fas fa-image"></i> Subir logo</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="logo-del" ${s.estudio.logo ? '' : 'hidden'}><i class="fas fa-trash"></i> Quitar</button>
                    <span class="hint">PNG o JPG. Se ajusta automáticamente y aparece en recibos, liquidaciones y PDF.</span>
                  </div>
                </div></div>
              <div class="field full"><label>Razón social / Estudio</label><input class="input" name="razonSocial" value="${s.estudio.razonSocial}"></div>
              <div class="field"><label>CUIT</label><input class="input" name="cuit" value="${s.estudio.cuit}"></div>
              <div class="field"><label>Matrícula</label><input class="input" name="matricula" value="${s.estudio.matricula}"></div>
              <div class="field full"><label>Domicilio</label><input class="input" name="domicilio" value="${s.estudio.domicilio}"></div>
              <div class="field full"><label>Gráfico del resumen de costo laboral</label>
                <select class="select" name="grafico">${ESTILOS_GRAFICO.map(([k, l]) => html`<option value="${k}" ${s.estudio.grafico === k || (!s.estudio.grafico && k === 'barra') ? 'selected' : ''}>${l}</option>`)}</select>
                <span class="hint">El Decreto 407/2026 prevé un resumen gráfico en el anverso del recibo. Si lo ocultás, confirmá con tu contador que cumplís el modelo oficial.</span></div>
              <div class="field full"><label>Lugar de pago habitual</label><input class="input" name="lugarPago" value="${s.estudio.lugarPago}" placeholder="Ej: Mendoza, Capital"></div>
            </div>
            <div class="card-footer"><button class="btn btn-primary btn-sm" type="submit">Guardar datos</button></div></form>

          <form class="card" id="f-msg"><div class="card-header"><h3><i class="fab fa-whatsapp" style="color:var(--wa-dark)"></i> Mensajes para compartir</h3></div>
            <div class="card-body" style="display:grid;gap:1rem">
              <p class="muted-text" style="font-size:.88rem">Texto predeterminado al compartir por WhatsApp o correo. Tocá una variable para insertarla donde tengas el cursor.</p>
              <div class="chips-vars">${PLACEHOLDERS.map(([k, d]) => html`<button type="button" class="var-chip" data-var="{${k}}" title="${d}">{${k}}</button>`)}</div>
              <div class="field"><label>Recibo de haberes (sueldo)</label><textarea class="textarea" name="sueldo" rows="6" maxlength="1000">${s.mensajes?.sueldo || DEFAULT_TEMPLATES.sueldo}</textarea></div>
              <div class="field"><label>Liquidación final</label><textarea class="textarea" name="liquidacion" rows="6" maxlength="1000">${s.mensajes?.liquidacion || DEFAULT_TEMPLATES.liquidacion}</textarea></div>
            </div>
            <div class="card-footer" style="display:flex;gap:.6rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" type="submit">Guardar mensajes</button>
              <button class="btn btn-ghost btn-sm" type="button" data-action="msg-default">Volver al mensaje original</button></div></form>

          <form class="card" id="f-params"><div class="card-header"><h3>Aportes y parámetros</h3></div>
            <div class="card-body form-grid">
              ${numField('Jubilación (%)', 'jubilacion', s.aportes.jubilacion)}
              ${numField('Ley 19.032 / PAMI (%)', 'pami', s.aportes.pami)}
              ${numField('Obra social (%)', 'obraSocial', s.aportes.obraSocial)}
              ${numField('Cuota sindical (%)', 'sindicato', s.aportes.sindicato)}
              ${numField('Jornaleros: obra social adicional (%)', 'j_osAdicPct', s.jornal.osAdicPct, 'Sobre la remuneración con aportes (valor tomado de un recibo real: verificalo).')}
              ${numField('Jornaleros: cuota sindical afiliados (%)', 'j_sindicatoPct', s.jornal.sindicatoPct)}
              ${numField('Jornaleros: seguro de vida ($ por recibo)', 'j_seguroVida', s.jornal.seguroVida)}
              <label class="check full"><input type="checkbox" name="j_redondeo" ${s.jornal.redondeo !== false ? 'checked' : ''}><span>Redondear el neto de jornaleros al peso<small>Agrega el concepto “Redondeo” para que el neto quede en pesos enteros.</small></span></label>
              ${numField('Divisor del día de feriado trabajado', 'divisorFeriado', s.divisorFeriado, 'Día adicional = remuneración mensual / divisor (25 para mensualizados). Verificá tu convenio.')}
              ${numField('Tope remunerativo para aportes', 'topeRemunerativo', s.topeRemunerativo, '0 = sin tope')}
              ${numField('Período de prueba (meses)', 'periodoPruebaMeses', s.periodoPruebaMeses, '0 = automático según la fecha de egreso')}
            </div>
            <div class="card-body form-grid" style="border-top:1px solid var(--border)">
              <div class="fieldset-title">Contribuciones patronales (% — valores de referencia, verificar con tu estudio contable)</div>
              ${numField('SIPA', 'p_sipa', s.patronales.sipa)}${numField('INSSJP (PAMI)', 'p_pami', s.patronales.pami)}
              ${numField('Asignaciones familiares', 'p_asignaciones', s.patronales.asignaciones)}${numField('Fondo Nacional de Empleo', 'p_fne', s.patronales.fne)}
              ${numField('Obra social', 'p_obraSocial', s.patronales.obraSocial)}${numField('ART', 'p_art', s.patronales.art)}
              ${numField('Sindical / solidaria', 'p_sindical', s.patronales.sindical)}${numField('Cámaras empresariales', 'p_camaras', s.patronales.camaras)}
              ${numField('Otras contribuciones', 'p_otros', s.patronales.otros)}
            </div>
            <div class="card-footer" style="display:flex;gap:.6rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" type="submit">Guardar parámetros</button>
              <button class="btn btn-ghost btn-sm" type="button" data-action="restore">Restaurar valores por defecto</button></div></form>
        </div>

        <div style="display:grid;gap:1.2rem">
          <div class="card"><div class="card-header"><h3>Mi cuenta</h3></div>
            <div class="card-body" style="display:grid;gap:1rem">
              <form id="f-name" class="field"><label>Nombre</label>
                <div style="display:flex;gap:.6rem"><input class="input" name="name" value="${ctx.user.name}"><button class="btn btn-outline" type="submit">Actualizar</button></div></form>
              <div class="field"><label>Correo</label><input class="input" value="${ctx.user.email}" disabled></div>
              <div class="muted-text" style="font-size:.85rem">Acceso: ${ctx.user.provider === 'google.com' ? 'Google' : ctx.user.isDemo ? 'Modo demo' : 'Correo y contraseña'}${p.createdAt ? ' · Alta: ' + dateTimeAR(p.createdAt) : ''}</div>
            </div></div>

          <div class="card"><div class="card-header"><h3>Plan</h3></div>
            <div class="card-body plan-box"><div><strong style="font-size:1.1rem">${plan.name}</strong><p class="muted-text">${plan.tagline}</p></div>
              ${plan.id === 'free' ? html`<a class="btn btn-primary btn-sm" href="${ROUTES.plans}">Mejorar plan</a>` : html`<span class="badge badge-success">Activo</span>`}</div></div>

          <div class="card"><div class="card-header"><h3>Datos</h3></div>
            <div class="card-body" style="display:grid;gap:.8rem">
              <p class="muted-text" style="font-size:.88rem">Descargá una copia de tus empleados, nóminas, liquidaciones y ajustes.</p>
              <div><button class="btn btn-outline btn-sm" data-action="backup"><i class="fas fa-download"></i> Exportar respaldo (JSON)</button></div>
              ${ctx.user.isDemo ? html`<div><button class="btn btn-danger btn-sm" data-action="wipe"><i class="fas fa-trash"></i> Borrar datos del modo demo</button></div>` : ''}
            </div></div>
        </div>
      </div>`;

    const save = async (next, msg) => {
      try { await ctx.updateSettings(next); ctx.toast(msg, 'success'); } catch { ctx.toast('No se pudo guardar. Intentá de nuevo.', 'error'); }
    };

    $('#f-estudio', el).addEventListener('submit', (e) => {
      e.preventDefault(); const d = readForm(e.target);
      save({ ...ctx.state.settings, estudio: { ...ctx.state.settings.estudio, razonSocial: d.razonSocial.trim(), cuit: d.cuit.trim(), matricula: d.matricula.trim(), domicilio: d.domicilio.trim(), lugarPago: d.lugarPago.trim(), grafico: d.grafico } }, 'Datos guardados');
    });

    // Mensajes para compartir: las variables se insertan en el campo donde estaba el cursor
    let lastMsgField = null;
    $('#f-msg', el).addEventListener('focusin', (e) => { if (e.target.matches('textarea')) lastMsgField = e.target; });
    on(el, 'click', '[data-var]', (_, b) => {
      const t = lastMsgField || $('#f-msg textarea', el);
      const a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a;
      t.value = t.value.slice(0, a) + b.dataset.var + t.value.slice(z);
      t.focus(); t.selectionStart = t.selectionEnd = a + b.dataset.var.length;
    });
    $('#f-msg', el).addEventListener('submit', (e) => {
      e.preventDefault(); const d = readForm(e.target);
      if (!d.sueldo.trim() || !d.liquidacion.trim()) return ctx.toast('Los mensajes no pueden quedar vacíos.', 'warning');
      save({ ...ctx.state.settings, mensajes: { sueldo: d.sueldo.trim(), liquidacion: d.liquidacion.trim() } }, 'Mensajes guardados');
    });
    on(el, 'click', '[data-action="msg-default"]', () => {
      const f = $('#f-msg', el);
      f.elements.sueldo.value = DEFAULT_TEMPLATES.sueldo; f.elements.liquidacion.value = DEFAULT_TEMPLATES.liquidacion;
      ctx.toast('Se cargó el mensaje original. Guardá para aplicarlo.', 'info');
    });

    $('#f-params', el).addEventListener('submit', (e) => {
      e.preventDefault(); const d = readForm(e.target);
      const pct = (v) => Math.min(100, Math.max(0, num(v)));
      save({
        ...ctx.state.settings,
        aportes: { jubilacion: pct(d.jubilacion), pami: pct(d.pami), obraSocial: pct(d.obraSocial), sindicato: pct(d.sindicato) },
        patronales: Object.fromEntries(['sipa', 'pami', 'asignaciones', 'fne', 'obraSocial', 'art', 'sindical', 'camaras', 'otros'].map((k) => [k, pct(d['p_' + k])])),
        jornal: { osAdicPct: pct(d.j_osAdicPct), sindicatoPct: pct(d.j_sindicatoPct), seguroVida: Math.max(0, num(d.j_seguroVida)), redondeo: !!d.j_redondeo },
        divisorFeriado: Math.max(1, num(d.divisorFeriado) || 25),
        topeRemunerativo: Math.max(0, num(d.topeRemunerativo)),
        periodoPruebaMeses: Math.min(24, Math.max(0, Math.round(num(d.periodoPruebaMeses)))),
      }, 'Parámetros guardados');
    });

    // Logo: se guarda al subirlo, sin esperar al botón "Guardar datos"
    const refreshLogo = () => {
      const logo = ctx.state.settings.estudio.logo;
      $('#logo-preview', el).innerHTML = logoPreview(logo);
      $('[data-action="logo-del"]', el).hidden = !logo;
    };
    on(el, 'click', '[data-action="logo-pick"]', () => $('#logo-file', el).click());
    $('#logo-file', el).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const logo = await fileToLogo(file);
        await ctx.updateSettings({ ...ctx.state.settings, estudio: { ...ctx.state.settings.estudio, logo } });
        refreshLogo(); ctx.toast('Logo guardado. Ya aparece en los recibos y PDF.', 'success');
      } catch (err) {
        ctx.toast(err.code === 'FORMAT' ? 'Usá una imagen PNG, JPG o WebP.' : err.code === 'SIZE' ? 'La imagen es demasiado pesada (máx. 5 MB).' : 'No se pudo cargar el logo.', 'error');
      }
    });
    on(el, 'click', '[data-action="logo-del"]', async () => {
      await ctx.updateSettings({ ...ctx.state.settings, estudio: { ...ctx.state.settings.estudio, logo: null } });
      refreshLogo(); ctx.toast('Logo eliminado', 'success');
    });

    $('#f-name', el).addEventListener('submit', async (e) => {
      e.preventDefault(); const name = readForm(e.target).name.trim();
      if (name.length < 2) return ctx.toast('Ingresá un nombre válido.', 'warning');
      try { await updateDisplayName(name); ctx.user.name = name; ctx.toast('Nombre actualizado. Se verá en todo el panel al recargar.', 'success'); }
      catch { ctx.toast('No se pudo actualizar el nombre.', 'error'); }
    });

    on(el, 'click', '[data-action="restore"]', async () => {
      if (!(await ctx.confirmDialog({ title: 'Restaurar valores', message: 'Se restablecerán aportes, tope y período de prueba. Los datos del estudio se conservan.', confirmText: 'Restaurar' }))) return;
      await save({ ...DEFAULT_SETTINGS, estudio: ctx.state.settings.estudio, mensajes: ctx.state.settings.mensajes }, 'Valores restaurados');
      ctx.navigate('configuracion');
    });

    on(el, 'click', '[data-action="backup"]', async () => {
      const [employees, liquidations, payrolls] = await Promise.all([ctx.services.employees.list(), ctx.services.liquidations.list(), ctx.services.payroll.list()]);
      const payload = { app: 'ArgenLiquid PRO', exportedAt: new Date().toISOString(), user: ctx.user.email, settings: ctx.state.settings, employees, liquidations, payrolls };
      downloadFile(`argenliquid_respaldo_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });

    on(el, 'click', '[data-action="wipe"]', async () => {
      if (!(await ctx.confirmDialog({ title: 'Borrar datos demo', message: 'Se eliminarán empleados, liquidaciones y ajustes guardados en este navegador.', confirmText: 'Borrar', danger: true }))) return;
      await ctx.services.repo.clearAll();
      location.reload();
    });
  },
};
