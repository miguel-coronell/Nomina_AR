import { html } from '../../../../core/html.js';
import { $, on, num } from '../../../../core/dom.js';
import { money, dateAR, todayISO } from '../../../../core/format.js';
import { ESCALAS, ZONAS, SERENO_ZONA_A, SERENO_BASE, ESCALAS_BASE, vigenciaEscala, listaConvenios } from '../../../../domain/convenios/escalas.js';
import { BASES_MINIMAS_SIPA, BASES_SIPA_FABRICA } from '../../../../domain/legal/params.js';

/**
 * ESCALAS Y VIGENCIAS — el usuario carga acá el valor hora por convenio/categoría/zona, la base mínima SIPA y el básico
 * Sereno, cada uno con la fecha desde la que rige. Cada período de nómina toma la vigencia anterior o igual a su fecha de inicio.
 * Se guarda en settings.tablas y se suma a los valores que trae la app (misma fecha = pisa el de fábrica).
 */
const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
const nombreZona = (z) => `zona ${z}`;
const conveniosEscalas = () => listaConvenios().filter((c) => c.id !== 'fuera_convenio');
const tablasDe = (ctx) => structuredClone(ctx.state.settings.tablas || { convenios: {}, basesSipa: [], sereno: [] });

export default {
  id: 'escalas', title: 'Escalas y vigencias', icon: 'fa-table-list', group: 'Cuenta',

  mount(el, ctx) {
    let convenio = Object.keys(ESCALAS)[0] || conveniosEscalas()[0]?.id || '';
    let zona = 'A';

    const guardar = async (t, msg) => {
      try { await ctx.updateSettings({ ...ctx.state.settings, tablas: t }); ctx.toast(msg, 'success'); pintar(); }
      catch { ctx.toast('No se pudo guardar. Intentá de nuevo.', 'error'); }
    };
    const modal = (title, body, onSave, size = 'md') => {
      const footer = document.createElement('div');
      footer.className = 'modal-actions';
      footer.innerHTML = '<button type="button" class="btn btn-ghost" data-c>Cancelar</button><button type="button" class="btn btn-primary" data-s><i class="fas fa-floppy-disk"></i> Guardar</button>';
      const wrap = document.createElement('div'); wrap.innerHTML = body;
      const m = ctx.openModal({ title, body: wrap, footer, size });
      footer.querySelector('[data-c]').onclick = m.close;
      footer.querySelector('[data-s]').onclick = async () => { if (await onSave(wrap)) m.close(); };
      return wrap;
    };

    function pintar() {
      const esc = ESCALAS[convenio];
      const hoy = todayISO();
      const vigs = esc ? [...esc.vigencias].sort((a, b) => a.desde.localeCompare(b.desde)) : [];
      const vigenteHoy = vigs.filter((v) => v.desde <= hoy).pop()?.desde;
      const userConv = ctx.state.settings.tablas?.convenios?.[convenio];
      const delUsuario = (desde) => !!userConv?.vigencias?.some((v) => v.desde === desde && v.zonas?.[zona]);

      el.innerHTML = html`
        <div class="page-head"><div><h2>Escalas y vigencias</h2><p>Cargá los valores que cambian con paritarias y resoluciones, indicando <b>desde qué fecha rigen</b>. Cada liquidación toma el valor vigente a su fecha de inicio.</p></div></div>
        <div class="alert alert-info" style="margin-bottom:1.2rem"><i class="fas fa-circle-info"></i><div>Los valores marcados <span class="badge badge-gray">de fábrica</span> vienen con la app y conviene verificarlos con la escala homologada. Si cargás otra fila con la misma fecha, la tuya reemplaza a la de fábrica. No incluyas sumas no remunerativas en el valor hora.</div></div>

        <div class="card" style="margin-bottom:1.2rem"><div class="card-header"><h3>Valor hora por convenio y categoría</h3>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-action="conv-nuevo"><i class="fas fa-plus"></i> Nuevo convenio</button>${esc ? html`<button class="btn btn-outline btn-sm" data-action="conv-editar"><i class="fas fa-pen"></i> Categorías</button><button class="btn btn-primary btn-sm" data-action="vig-nueva"><i class="fas fa-calendar-plus"></i> Cargar nueva vigencia</button>` : html`<button class="btn btn-primary btn-sm" data-action="conv-activar"><i class="fas fa-list-check"></i> Cargar categorías</button>`}</div></div>
          <div class="card-body" style="display:grid;gap:1rem">
            <div class="form-grid">
              <div class="field"><label>Convenio</label><select class="select" id="sel-conv">${conveniosEscalas().map((c) => html`<option value="${c.id}" ${c.id === convenio ? 'selected' : ''}>${c.nombre}</option>`)}</select></div>
              <div class="field"><label>Zona</label><select class="select" id="sel-zona">${ZONAS.map(([k, l]) => html`<option value="${k}" ${k === zona ? 'selected' : ''}>${l}</option>`)}</select></div>
            </div>
            ${esc ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Categoría</th>${vigs.map((v) => html`<th class="num" style="white-space:nowrap">Desde ${dateAR(v.desde)}${v.desde === vigenteHoy ? html` <span class="badge badge-success">vigente hoy</span>` : ''}${delUsuario(v.desde) ? html` <button class="icon-btn" title="Quitar mi carga de esta fecha" data-action="vig-del" data-desde="${v.desde}"><i class="fas fa-trash"></i></button>` : ''}</th>`)}</tr></thead>
              <tbody>${esc.categorias.map((c) => html`<tr><td><b>${c}</b></td>${vigs.map((v) => { const val = Object.entries(v.zonas?.[zona] || {}).find(([k]) => k.toLowerCase() === c.toLowerCase())?.[1]; return html`<td class="num">${val ? money(val) : html`<span class="muted-text">—</span>`}</td>`; })}</tr>`)}</tbody></table></div>
              <p class="muted-text" style="font-size:.84rem">«—» = no hay valor cargado para esa zona en esa fecha: en ese caso la liquidación usa el último valor anterior que sí exista. Presentismo sugerido del convenio: ${esc.presentismoPct}%.</p>` : html`<p class="muted-text">Este convenio todavía no tiene escala de valor hora. Cargá sus categorías y después los valores con la fecha desde la que rigen.</p>`}
          </div></div>

        <div class="grid grid-2" style="align-items:start">
          ${simple('Base imponible mínima SIPA', 'Se usa para la obra social adicional de jornaleros (piso = 2 × la base). La publica ANSES todos los meses.', BASES_MINIMAS_SIPA, BASES_SIPA_FABRICA, 'sipa', true)}
          ${simple('Básico mensual Sereno — Zona A', 'Base del seguro de vida colectivo (art. 108 CCT 76/75).', SERENO_ZONA_A, SERENO_BASE, 'sereno', false)}
        </div>`;
    }

    const simple = (titulo, ayuda, lista, fabrica, clave, conFuente) => html`
      <div class="card"><div class="card-header"><h3>${titulo}</h3><button class="btn btn-primary btn-sm" data-action="simple-nuevo" data-k="${clave}"><i class="fas fa-plus"></i> Cargar vigencia</button></div>
        <div class="card-body" style="display:grid;gap:.8rem"><p class="muted-text" style="font-size:.86rem">${ayuda}</p>
          <div class="table-wrap"><table class="table"><thead><tr><th>Rige desde</th><th class="num">Valor</th>${conFuente ? html`<th>Fuente</th>` : ''}<th></th></tr></thead>
            <tbody>${[...lista].sort((a, b) => b.desde.localeCompare(a.desde)).map((x) => { const fab = fabrica.some((f) => f.desde === x.desde && f.valor === x.valor); return html`<tr><td>${dateAR(x.desde)}${x.desde <= todayISO() && x.desde === [...lista].filter((y) => y.desde <= todayISO()).sort((a, b) => b.desde.localeCompare(a.desde))[0]?.desde ? html` <span class="badge badge-success">vigente hoy</span>` : ''}</td><td class="num">${money(x.valor)}</td>${conFuente ? html`<td>${x.fuente || '—'}</td>` : ''}<td style="text-align:right">${fab ? html`<span class="badge badge-gray">de fábrica</span>` : html`<button class="icon-btn" title="Quitar" data-action="simple-del" data-k="${clave}" data-desde="${x.desde}"><i class="fas fa-trash"></i></button>`}</td></tr>`; })}</tbody></table></div></div></div>`;

    // ---- eventos ----
    el.addEventListener('change', (e) => {
      if (e.target.id === 'sel-conv') { convenio = e.target.value; pintar(); }
      if (e.target.id === 'sel-zona') { zona = e.target.value; pintar(); }
    });

    on(el, 'click', '[data-action]', async (_, b) => {
      const a = b.dataset.action;
      const t = tablasDe(ctx); t.convenios ||= {}; t.basesSipa ||= []; t.sereno ||= [];

      if (a === 'conv-nuevo') {
        modal('Nuevo convenio', `<div class="form-grid">
          <div class="field full"><label>Nombre del convenio *</label><input class="input" name="nombre" placeholder="Ej: CCT 260/75 — Metalúrgicos (UOM)"></div>
          <div class="field"><label>Presentismo sugerido (%)</label><input class="input" type="number" step="0.01" min="0" name="pres" value="0"></div>
          <div class="field full"><label>Categorías * (separadas por coma)</label><input class="input" name="cats" placeholder="Ej: Peón, Medio Oficial, Oficial"></div></div>`, async (w) => {
          const nombre = w.querySelector('[name=nombre]').value.trim(), cats = [...new Set(w.querySelector('[name=cats]').value.split(',').map((x) => x.trim()).filter(Boolean))];
          if (!nombre || !cats.length) { ctx.toast('Completá el nombre y al menos una categoría.', 'warning'); return false; }
          let id = slug(nombre) || 'convenio'; while (listaConvenios().some((c) => c.id === id)) id += '_2';
          t.convenios[id] = { nombre, unidad: 'hora', presentismoPct: Math.max(0, num(w.querySelector('[name=pres]').value)), categorias: cats, vigencias: [] };
          convenio = id; await guardar(t, 'Convenio creado. Ahora cargá sus valores con «Cargar nueva vigencia».'); return true;
        });
      }

      if (a === 'conv-activar') {
        const nombre = conveniosEscalas().find((c) => c.id === convenio)?.nombre || convenio;
        modal(`Categorías — ${nombre}`, `<div class="form-grid">
          <div class="field"><label>Presentismo sugerido (%)</label><input class="input" type="number" step="0.01" min="0" name="pres" value="0"></div>
          <div class="field full"><label>Categorías * (separadas por coma)</label><input class="input" name="cats" placeholder="Ej: Administrativo A, Cajero B, Vendedor A"></div></div>`, async (w) => {
          const cats = [...new Set(w.querySelector('[name=cats]').value.split(',').map((x) => x.trim()).filter(Boolean))];
          if (!cats.length) { ctx.toast('Escribí al menos una categoría.', 'warning'); return false; }
          t.convenios[convenio] = { nombre, unidad: 'hora', presentismoPct: Math.max(0, num(w.querySelector('[name=pres]').value)), categorias: cats, vigencias: [] };
          await guardar(t, 'Categorías guardadas. Ahora cargá los valores con «Cargar nueva vigencia».'); return true;
        });
      }

      if (a === 'conv-editar') {
        const c = ESCALAS[convenio];
        modal(`Categorías — ${c.nombre}`, `<div class="form-grid">
          <div class="field full"><label>Nombre</label><input class="input" name="nombre" value="${c.nombre.replace(/"/g, '&quot;')}"></div>
          <div class="field"><label>Presentismo sugerido (%)</label><input class="input" type="number" step="0.01" min="0" name="pres" value="${c.presentismoPct}"></div>
          <div class="field full"><label>Categorías (separadas por coma)</label><input class="input" name="cats" value="${c.categorias.join(', ').replace(/"/g, '&quot;')}"><span class="hint">Podés sumar categorías nuevas. Las que trae la app de fábrica no se pueden quitar.</span></div></div>`, async (w) => {
          const cats = [...new Set(w.querySelector('[name=cats]').value.split(',').map((x) => x.trim()).filter(Boolean))];
          const fab = ESCALAS_BASE[convenio]?.categorias || [];
          const u = t.convenios[convenio] ||= { vigencias: [] };
          u.nombre = w.querySelector('[name=nombre]').value.trim() || c.nombre; u.presentismoPct = Math.max(0, num(w.querySelector('[name=pres]').value));
          u.categorias = cats.filter((x) => !fab.includes(x));
          await guardar(t, 'Convenio actualizado'); return true;
        });
      }

      if (a === 'vig-nueva') {
        const c = ESCALAS[convenio];
        const w = modal(`Nueva vigencia — ${c.nombre}`, `<div class="form-grid">
          <div class="field"><label>Rige desde *</label><input class="input" type="date" name="desde" value="${todayISO().slice(0, 8)}01"></div>
          <div class="field"><label>Zona</label><select class="select" name="zona">${ZONAS.map(([k, l]) => `<option value="${k}" ${k === zona ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="fieldset-title">Valor por hora de cada categoría ($, sin sumas no remunerativas)</div>
          ${c.categorias.map((cat, i) => `<div class="field"><label>${cat.replace(/</g, '&lt;')}</label><input class="input" type="number" step="0.01" min="0" data-cat="${i}"></div>`).join('')}</div>
          <p class="muted-text" style="font-size:.84rem;margin-top:.6rem">Dejá vacía una categoría para no cargarle valor en esa fecha. Si ya había valores para esa fecha y zona, se reemplazan.</p>`, async (wr) => {
          const desde = wr.querySelector('[name=desde]').value, z = wr.querySelector('[name=zona]').value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) { ctx.toast('Indicá desde qué fecha rige.', 'warning'); return false; }
          const vals = {}; c.categorias.forEach((cat, i) => { const v = num(wr.querySelector(`[data-cat="${i}"]`).value); if (v > 0) vals[cat] = v; });
          if (!Object.keys(vals).length) { ctx.toast('Cargá al menos un valor.', 'warning'); return false; }
          const u = t.convenios[convenio] ||= { vigencias: [] }; u.vigencias ||= [];
          let v = u.vigencias.find((x) => x.desde === desde); if (!v) u.vigencias.push(v = { desde, zonas: {} });
          v.zonas[z] = vals; zona = z;
          await guardar(t, `Vigencia desde ${dateAR(desde)} guardada. Las liquidaciones de esa fecha en adelante usan estos valores; recalculá las que ya tenías abiertas.`); return true;
        }, 'lg');
        // Precarga con el último valor vigente (sirve de punto de partida para el aumento)
        const precargar = () => { const z = w.querySelector('[name=zona]').value, d = w.querySelector('[name=desde]').value || todayISO(); c.categorias.forEach((cat, i) => { const inp = w.querySelector(`[data-cat="${i}"]`); if (!inp.value) inp.placeholder = String(vigenciaEscala(convenio, cat, z, d)?.valor ?? ''); }); };
        precargar(); w.addEventListener('change', precargar);
      }

      if (a === 'vig-del') {
        if (!(await ctx.confirmDialog({ title: 'Quitar valores cargados', message: `Se quitan los valores que cargaste para la ${nombreZona(zona)} desde ${dateAR(b.dataset.desde)}. Si había un valor de fábrica con esa fecha, vuelve a regir.`, confirmText: 'Quitar', danger: true }))) return;
        const u = t.convenios[convenio]; const v = u?.vigencias?.find((x) => x.desde === b.dataset.desde);
        if (v) { delete v.zonas[zona]; if (!Object.keys(v.zonas).length) u.vigencias = u.vigencias.filter((x) => x !== v); }
        await guardar(t, 'Valores quitados');
      }

      if (a === 'simple-nuevo') {
        const sipa = b.dataset.k === 'sipa';
        modal(sipa ? 'Base mínima SIPA' : 'Básico Sereno Zona A', `<div class="form-grid">
          <div class="field"><label>Rige desde *</label><input class="input" type="date" name="desde" value="${todayISO().slice(0, 8)}01"></div>
          <div class="field"><label>Valor ($) *</label><input class="input" type="number" step="0.01" min="0" name="valor"></div>
          ${sipa ? '<div class="field full"><label>Fuente</label><input class="input" name="fuente" placeholder="Ej: Res. ANSES 304/2026"></div>' : ''}</div>`, async (w) => {
          const desde = w.querySelector('[name=desde]').value, valor = num(w.querySelector('[name=valor]').value);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !(valor > 0)) { ctx.toast('Completá la fecha y un valor mayor a cero.', 'warning'); return false; }
          const arr = sipa ? t.basesSipa : t.sereno; const i = arr.findIndex((x) => x.desde === desde); if (i >= 0) arr.splice(i, 1);
          arr.push(sipa ? { desde, valor, fuente: w.querySelector('[name=fuente]').value.trim() } : { desde, valor });
          await guardar(t, 'Vigencia guardada'); return true;
        });
      }

      if (a === 'simple-del') {
        const sipa = b.dataset.k === 'sipa';
        if (!(await ctx.confirmDialog({ title: 'Quitar vigencia', message: `Se quita la fila que rige desde ${dateAR(b.dataset.desde)}.`, confirmText: 'Quitar', danger: true }))) return;
        const key = sipa ? 'basesSipa' : 'sereno'; t[key] = t[key].filter((x) => x.desde !== b.dataset.desde);
        await guardar(t, 'Vigencia quitada');
      }
    });

    pintar();
  },
};
