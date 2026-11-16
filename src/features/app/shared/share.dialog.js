/**
 * Diálogos para compartir recibos de haberes y liquidaciones finales por WhatsApp o correo.
 *   sharePayslip(ctx, run, line)   → un recibo de nómina
 *   shareLiquidacion(ctx, record)  → una liquidación final
 *   shareBatch(ctx, run)           → lista de toda la nómina, un clic por empleado
 */
import { html } from '../../../core/html.js';
import { $, $$ } from '../../../core/dom.js';
import { money, dateAR, initials } from '../../../core/format.js';
import { motivoLabel } from '../../../domain/legal/params.js';
import { payslipPDFFile, liquidacionPDFFile } from '../../../services/pdf/index.js';
import { buildMessage, normalizePhone, prettyPhone, isEmail, whatsappLink, mailtoLink, PLACEHOLDERS } from '../../../services/share.service.js';

/** "Pérez, Juan Carlos" → "Juan Carlos" para saludar; si no hay coma se usa el nombre tal cual. */
const saludoDe = (name = '') => (name.includes(',') ? name.split(',').slice(1).join(' ').trim() || name : name);
const empresaDe = (ctx) => ctx.state.settings.estudio.razonSocial || ctx.user.name || 'Nomina AR';

/** Abre un enlace externo sin perder la pestaña de la app. */
function openLink(url, sameTab = false) {
  const a = document.createElement('a');
  a.href = url;
  if (!sameTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  document.body.appendChild(a); a.click(); a.remove();
}

const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] }); } catch { return false; }
};

const downloadBlob = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

async function contactOf(ctx, employeeId) {
  if (!employeeId) return {};
  try {
    const e = (await ctx.services.employees.list()).find((x) => x.id === employeeId);
    return e ? { phone: e.telefono || '', email: e.email || '' } : {};
  } catch { return {}; }
}

/* ---------------- Descriptores de documento ---------------- */
function payslipDoc(ctx, run, line, contact, estOverride) {
  const est = estOverride || ctx.state.settings.estudio;
  const fecha = line.pago?.estado === 'pagado' ? line.pago.fecha : run.fechaPago;
  return {
    kind: 'sueldo',
    docLabel: `Recibo de haberes · ${run.label}`,
    icon: 'fa-file-invoice-dollar',
    name: line.nombre,
    amount: money(line.totals.neto),
    amountLabel: 'Neto a cobrar',
    contact,
    vars: { nombre: saludoDe(line.nombre), periodo: run.label, neto: money(line.totals.neto), fecha: fecha ? dateAR(fecha) : 'a confirmar', empresa: empresaDe(ctx), motivo: '' },
    pdf: () => payslipPDFFile(run, line, est, ctx.user.name),
  };
}

function liquidacionDoc(ctx, rec, contact) {
  const est = ctx.state.settings.estudio;
  return {
    kind: 'liquidacion',
    docLabel: 'Liquidación final',
    icon: 'fa-file-signature',
    name: rec.employeeName,
    amount: money(rec.totals.neto),
    amountLabel: 'Total neto',
    contact,
    vars: { nombre: saludoDe(rec.employeeName), periodo: '', neto: money(rec.totals.neto), fecha: dateAR(rec.input.fechaEgreso), motivo: motivoLabel(rec.input.motivo), empresa: empresaDe(ctx) },
    pdf: () => liquidacionPDFFile({ ...rec, createdAt: rec.createdAt || new Date().toISOString() }, est, ctx.user.name, { patronales: ctx.state.settings.patronales }),
  };
}

/* ---------------- Diálogo principal ---------------- */
function openShareDialog(ctx, doc) {
  const { text, subject } = buildMessage(doc.kind, ctx.state.settings.mensajes, doc.vars);
  const dest = { wa: doc.contact.phone || '', mail: doc.contact.email || '' };
  let channel = 'wa';
  let file = null;

  const body = document.createElement('div');
  body.className = 'share';
  body.innerHTML = html`
    <div class="share-doc">
      <span class="share-doc-ico"><i class="fas ${doc.icon}"></i></span>
      <div class="share-doc-txt"><small>${doc.docLabel}</small><strong>${doc.name}</strong></div>
      <div class="share-doc-amt"><small>${doc.amountLabel}</small><b>${doc.amount}</b></div>
    </div>

    <div class="share-channels" role="tablist" aria-label="Canal de envío">
      <button type="button" class="share-ch active" role="tab" data-ch="wa"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></button>
      <button type="button" class="share-ch" role="tab" data-ch="mail"><i class="fas fa-envelope"></i><span>Correo</span></button>
    </div>

    <div class="field"><label id="sh-dest-label" for="sh-dest"></label>
      <div class="input-icon"><i class="fas lead" id="sh-dest-ico"></i><input class="input" id="sh-dest" autocomplete="off"></div>
      <span class="hint" id="sh-hint"></span></div>
    <div class="field" id="sh-subj-field" hidden><label for="sh-subject">Asunto</label><input class="input" id="sh-subject" value="${subject}"></div>
    <div class="field"><label for="sh-msg">Mensaje</label><textarea class="textarea" id="sh-msg" rows="8">${text}</textarea>
      <span class="hint">Mensaje predeterminado, editable. Podés cambiar el modelo en <a href="#/configuracion" data-close-share>Configuración</a>.</span></div>

    <div class="share-pdf">
      <div class="share-pdf-head"><i class="fas fa-paperclip"></i><div><strong>Adjuntar el PDF</strong>
        <small>WhatsApp y el correo no permiten adjuntar archivos automáticamente.</small></div></div>
      <div class="share-pdf-actions">
        <button type="button" class="btn btn-outline btn-sm" data-act="download"><i class="fas fa-file-arrow-down"></i> Descargar PDF</button>
        <button type="button" class="btn btn-outline btn-sm" data-act="native" hidden><i class="fas fa-share-nodes"></i> Compartir PDF</button>
      </div>
    </div>`;

  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  footer.innerHTML = '<button type="button" class="btn btn-ghost" data-c>Cerrar</button><button type="button" class="btn btn-whatsapp" data-send></button>';
  const m = ctx.openModal({ title: 'Compartir', body, footer, size: 'md' });

  const destEl = $('#sh-dest', body), msgEl = $('#sh-msg', body), subjEl = $('#sh-subject', body), hint = $('#sh-hint', body);
  const send = $('[data-send]', footer);

  const paintHint = () => {
    const v = destEl.value.trim();
    if (channel === 'wa') {
      const n = normalizePhone(v);
      hint.className = `hint ${!v ? '' : n.valid ? 'ok-text' : 'warn-text'}`;
      hint.innerHTML = !v ? '<i class="fas fa-circle-info"></i> Sin número guardado: vas a elegir el contacto dentro de WhatsApp.'
        : n.valid ? `<i class="fas fa-circle-check"></i> Se enviará a ${prettyPhone(n)}`
          : '<i class="fas fa-triangle-exclamation"></i> Revisá el número: debe incluir código de área (ej. 261 5123456).';
    } else {
      hint.className = `hint ${!v ? '' : isEmail(v) ? 'ok-text' : 'warn-text'}`;
      hint.innerHTML = !v ? '<i class="fas fa-circle-info"></i> Sin correo guardado: elegirás el destinatario en tu aplicación de correo.'
        : isEmail(v) ? '<i class="fas fa-circle-check"></i> Correo válido' : '<i class="fas fa-triangle-exclamation"></i> El correo no parece válido.';
    }
  };
  const paintChannel = () => {
    const wa = channel === 'wa';
    $$('.share-ch', body).forEach((b) => { const on = b.dataset.ch === channel; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('#sh-dest-label', body).textContent = wa ? 'Número de WhatsApp del empleado' : 'Correo electrónico del empleado';
    $('#sh-dest-ico', body).className = `fas lead ${wa ? 'fa-phone' : 'fa-at'}`;
    destEl.type = wa ? 'tel' : 'email'; destEl.inputMode = wa ? 'tel' : 'email';
    destEl.placeholder = wa ? 'Ej: 261 512 3456' : 'nombre@correo.com';
    destEl.value = dest[channel];
    $('#sh-subj-field', body).hidden = wa;
    send.className = `btn ${wa ? 'btn-whatsapp' : 'btn-primary'}`;
    send.innerHTML = wa ? '<i class="fab fa-whatsapp"></i> Abrir WhatsApp' : '<i class="fas fa-paper-plane"></i> Abrir correo';
    paintHint();
  };
  paintChannel();

  const getFile = async () => (file ||= await doc.pdf());
  const busy = (b, on) => (on ? b.setAttribute('aria-busy', 'true') : b.removeAttribute('aria-busy'));

  body.addEventListener('click', async (e) => {
    const ch = e.target.closest('[data-ch]');
    if (ch) { dest[channel] = destEl.value; channel = ch.dataset.ch; paintChannel(); return; }
    if (e.target.closest('[data-close-share]')) { m.close(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    busy(act, true);
    try {
      const f = await getFile();
      if (act.dataset.act === 'download') downloadBlob(f);
      else {
        const pdf = new File([f.blob], f.filename, { type: 'application/pdf' });
        await navigator.share({ files: [pdf], title: subjEl.value, text: msgEl.value });
      }
    } catch (err) {
      if (err?.name !== 'AbortError') { console.error(err); ctx.toast('No se pudo generar el PDF. Revisá tu conexión.', 'error'); }
    } finally { busy(act, false); }
  });
  destEl.addEventListener('input', () => { dest[channel] = destEl.value; paintHint(); });

  send.onclick = () => {
    const v = destEl.value.trim();
    if (!msgEl.value.trim()) return ctx.toast('El mensaje no puede estar vacío.', 'warning');
    if (channel === 'wa') openLink(whatsappLink(v, msgEl.value));
    else openLink(mailtoLink(v, subjEl.value, msgEl.value), true);
    ctx.toast(channel === 'wa' ? 'Abriendo WhatsApp…' : 'Abriendo tu aplicación de correo…', 'info', 2500);
  };
  $('[data-c]', footer).onclick = m.close;

  if (canShareFiles()) $('[data-act="native"]', body).hidden = false;
  return m;
}

export async function sharePayslip(ctx, run, line, estOverride) {
  return openShareDialog(ctx, payslipDoc(ctx, run, line, await contactOf(ctx, line.employeeId), estOverride));
}

export async function shareLiquidacion(ctx, rec) {
  return openShareDialog(ctx, liquidacionDoc(ctx, rec, await contactOf(ctx, rec.employeeId)));
}

/* ---------------- Envío por lote: toda la nómina ---------------- */
export async function shareBatch(ctx, run, estOverride) {
  const emps = await ctx.services.employees.list();
  const contacts = new Map(emps.map((e) => [e.id, { phone: e.telefono || '', email: e.email || '' }]));
  const sent = new Set();
  const body = document.createElement('div');
  body.className = 'share';

  const draw = () => {
    const ready = run.lines.filter((l) => { const c = contacts.get(l.employeeId) || {}; return normalizePhone(c.phone).valid || isEmail(c.email); }).length;
    body.innerHTML = html`
      <div class="alert alert-info"><i class="fas fa-circle-info"></i><div>Tocá <b>WhatsApp</b> o <b>Correo</b> en cada empleado: se abre la conversación con el mensaje predeterminado listo para enviar.
        ${ready < run.lines.length ? html`<br><b>${run.lines.length - ready}</b> empleado(s) sin teléfono ni correo válido: completalos en su ficha.` : ''}</div></div>
      <ul class="share-list">${run.lines.map((l) => {
        const c = contacts.get(l.employeeId) || {};
        const wa = normalizePhone(c.phone).valid, mail = isEmail(c.email);
        return html`<li class="share-row ${sent.has(l.employeeId) ? 'done' : ''}">
          <span class="avatar">${initials(l.nombre)}</span>
          <div class="share-row-txt"><strong>${l.nombre}</strong><small>${money(l.totals.neto)}${sent.has(l.employeeId) ? html` · <span class="ok-text"><i class="fas fa-check"></i> Enviado</span>` : ''}</small></div>
          <div class="share-row-btns">
            <button class="icon-btn wa" data-wa="${l.employeeId}" title="${wa ? 'Enviar por WhatsApp' : 'Sin teléfono válido'}" ${wa ? '' : 'disabled'}><i class="fab fa-whatsapp"></i></button>
            <button class="icon-btn mail" data-mail="${l.employeeId}" title="${mail ? 'Enviar por correo' : 'Sin correo válido'}" ${mail ? '' : 'disabled'}><i class="fas fa-envelope"></i></button>
            <button class="icon-btn" data-more="${l.employeeId}" title="Más opciones (PDF, editar mensaje)"><i class="fas fa-ellipsis"></i></button>
          </div></li>`;
      })}</ul>`;
  };
  draw();

  const footer = document.createElement('div');
  footer.className = 'modal-actions';
  footer.innerHTML = '<button type="button" class="btn btn-primary" data-c>Listo</button>';
  const m = ctx.openModal({ title: `Compartir recibos · ${run.label}`, body, footer, size: 'md' });
  footer.querySelector('[data-c]').onclick = m.close;

  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-wa],[data-mail],[data-more]');
    if (!b || b.disabled) return;
    const id = b.dataset.wa || b.dataset.mail || b.dataset.more;
    const line = run.lines.find((l) => l.employeeId === id);
    const doc = payslipDoc(ctx, run, line, contacts.get(id) || {}, estOverride);
    if (b.dataset.more) { m.close(); openShareDialog(ctx, doc); return; }
    const { text, subject } = buildMessage('sueldo', ctx.state.settings.mensajes, doc.vars);
    if (b.dataset.wa) openLink(whatsappLink(doc.contact.phone, text));
    else openLink(mailtoLink(doc.contact.email, subject, text), true);
    sent.add(id);
    const top = body.parentElement?.scrollTop;
    draw(); if (top) body.parentElement.scrollTop = top;
  });
  return m;
}

/** Botón reutilizable (icono) para filas y tarjetas. */
export const shareBtn = (attr, id, { label = false } = {}) =>
  label ? html`<button class="btn btn-outline btn-sm btn-share" ${attr}="${id}"><i class="fas fa-share-nodes"></i> Compartir</button>`
    : html`<button class="icon-btn share" ${attr}="${id}" title="Compartir por WhatsApp o correo"><i class="fas fa-share-nodes"></i></button>`;

export { PLACEHOLDERS };
