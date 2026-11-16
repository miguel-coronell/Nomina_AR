/**
 * Controlador de la página de acceso: login, registro, Google y recuperación.
 */
import { $, $$, readForm } from '../../core/dom.js';
import { safeNext } from '../../core/guard.js';
import { ROUTES } from '../../config/app.config.js';
import {
  authMode, currentUser, signInWithGoogle, signInWithEmail, registerWithEmail,
  sendPasswordReset, enterDemoMode, authErrorMessage,
} from '../../services/auth.service.js';
import { promoView } from './promo.view.js';
import { loginView, registerView, resetView, alertBox } from './auth.view.js';

const root = $('#auth-root');
const demo = authMode() === 'demo';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let mode = 'login';

const nextUrl = () => safeNext(new URLSearchParams(location.search).get('next') || ROUTES.app);
const goNext = () => location.replace(nextUrl());

function setBusy(busy) {
  $$('button, input', root).forEach((el) => { if (!el.classList.contains('link-btn')) el.disabled = busy; });
  const btn = $('#btn-submit', root);
  if (!btn) return;
  btn.setAttribute('aria-busy', busy);
  const icon = btn.querySelector('i');
  if (icon) { icon.dataset.cls ??= icon.className; icon.className = busy ? 'fas fa-circle-notch spin' : icon.dataset.cls; }
}

const showAlert = (type, msg) => { const el = $('#auth-alert', root); if (el) el.innerHTML = alertBox(type, msg); };
const clearErrors = () => {
  $$('[data-error]', root).forEach((e) => { e.textContent = ''; e.closest('.field')?.classList.remove('has-error'); });
  const a = $('#auth-alert', root); if (a) a.innerHTML = '';
};
function fieldErrors(errors) {
  let first;
  for (const [name, msg] of Object.entries(errors)) {
    const el = $(`[data-error="${name}"]`, root);
    if (!el) continue;
    el.textContent = msg; el.closest('.field')?.classList.add('has-error');
    first ??= $(`[name="${name}"]`, root);
  }
  first?.focus();
  return Object.keys(errors).length > 0;
}

function passwordScore(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
}

function render(next = mode) {
  mode = next;
  const view = mode === 'register' ? registerView({ demo }) : mode === 'reset' ? resetView() : loginView({ demo });
  root.innerHTML = view;
  document.title = { login: 'Ingresar', register: 'Crear cuenta', reset: 'Recuperar contraseña' }[mode] + ' | Nomina AR PRO';
}

/* ---------- acciones ---------- */
async function onGoogle() {
  clearErrors();
  if (demo) return showAlert('error', authErrorMessage({ code: 'FIREBASE_NOT_CONFIGURED' }));
  setBusy(true);
  try {
    const user = await signInWithGoogle();
    if (user) goNext();
  } catch (err) { showAlert('error', authErrorMessage(err)); }
  finally { setBusy(false); }
}

async function onLogin(form) {
  clearErrors();
  const d = readForm(form);
  const errors = {};
  if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Ingresá un correo válido.';
  if (!d.password) errors.password = 'Ingresá tu contraseña.';
  if (fieldErrors(errors)) return;
  if (demo) return showAlert('error', authErrorMessage({ code: 'FIREBASE_NOT_CONFIGURED' }));
  setBusy(true);
  try { await signInWithEmail(d.email.trim(), d.password, d.remember); goNext(); }
  catch (err) { showAlert('error', authErrorMessage(err)); setBusy(false); }
}

async function onRegister(form) {
  clearErrors();
  const d = readForm(form);
  const errors = {};
  if (d.name.trim().length < 2) errors.name = 'Ingresá tu nombre.';
  if (!EMAIL_RE.test(d.email.trim())) errors.email = 'Ingresá un correo válido.';
  if (d.password.length < 8) errors.password = 'Usá al menos 8 caracteres.';
  else if (passwordScore(d.password) < 2) errors.password = 'Combiná mayúsculas, minúsculas y números.';
  if (d.confirm !== d.password) errors.confirm = 'Las contraseñas no coinciden.';
  if (!d.terms) errors.terms = 'Tenés que aceptar los términos para continuar.';
  if (fieldErrors(errors)) return;
  if (demo) return showAlert('error', authErrorMessage({ code: 'FIREBASE_NOT_CONFIGURED' }));
  setBusy(true);
  try { await registerWithEmail({ name: d.name.trim(), email: d.email.trim(), password: d.password }); goNext(); }
  catch (err) { showAlert('error', authErrorMessage(err)); setBusy(false); }
}

async function onReset(form) {
  clearErrors();
  const { email } = readForm(form);
  if (fieldErrors(EMAIL_RE.test(email.trim()) ? {} : { email: 'Ingresá un correo válido.' })) return;
  if (demo) return showAlert('error', authErrorMessage({ code: 'FIREBASE_NOT_CONFIGURED' }));
  setBusy(true);
  try {
    await sendPasswordReset(email.trim());
    showAlert('success', 'Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña. Revisá también la carpeta de spam.');
  } catch (err) {
    // No revelamos si el correo existe: solo informamos errores de red/formato.
    const known = ['auth/network-request-failed', 'auth/invalid-email', 'auth/too-many-requests'];
    if (known.includes(err.code)) showAlert('error', authErrorMessage(err));
    else showAlert('success', 'Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña.');
  } finally { setBusy(false); }
}

/* ---------- eventos (delegación) ---------- */
root.addEventListener('click', (e) => {
  const modeBtn = e.target.closest('[data-mode]');
  if (modeBtn) { render(modeBtn.dataset.mode); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'google') onGoogle();
  if (action === 'demo') { enterDemoMode(); goNext(); }
  const tg = e.target.closest('[data-toggle-pass]');
  if (tg) {
    const input = $(`#${tg.dataset.togglePass}`, root);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    tg.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
  }
});

root.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'form-login') onLogin(e.target);
  if (e.target.id === 'form-register') onRegister(e.target);
  if (e.target.id === 'form-reset') onReset(e.target);
});

root.addEventListener('input', (e) => {
  if (e.target.matches('#form-register [name="password"]')) {
    $('#strength', root).dataset.level = e.target.value ? passwordScore(e.target.value) : 0;
  }
  const field = e.target.closest('.field');
  if (field?.classList.contains('has-error')) { field.classList.remove('has-error'); field.querySelector('[data-error]').textContent = ''; }
});

/* ---------- arranque ---------- */
$('#promo').innerHTML = promoView();
render(new URLSearchParams(location.search).get('modo') === 'registro' ? 'register' : 'login');
currentUser().then((u) => { if (u) goNext(); });
