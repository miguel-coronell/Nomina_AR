import { html, raw } from '../../core/html.js';
import { ROUTES } from '../../config/app.config.js';

const passField = (id, name, label, placeholder, autocomplete) => html`
  <div class="field">
    <label for="${id}">${label}</label>
    <div class="input-icon">
      <i class="fas fa-lock lead"></i>
      <input class="input" id="${id}" name="${name}" type="password" placeholder="${placeholder}" autocomplete="${autocomplete}" required>
      <button type="button" class="icon-btn toggle" data-toggle-pass="${id}" aria-label="Mostrar u ocultar contraseña"><i class="fas fa-eye"></i></button>
    </div>
    <span class="error" data-error="${name}"></span>
  </div>`;

const emailField = (autofocus = false) => html`
  <div class="field">
    <label for="email">Correo electrónico</label>
    <div class="input-icon">
      <i class="fas fa-envelope lead"></i>
      <input class="input" id="email" name="email" type="email" placeholder="tu@correo.com" autocomplete="email" required ${autofocus ? raw('autofocus') : ''}>
    </div>
    <span class="error" data-error="email"></span>
  </div>`;

const googleButton = (label) => html`
  <button type="button" class="btn btn-google btn-lg" data-action="google">
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.8 2.3-7.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
    <span>${label}</span>
  </button>`;

const tabs = (mode) => html`
  <div class="auth-tabs" role="tablist">
    <button type="button" role="tab" data-mode="login" aria-selected="${mode === 'login' ? 'true' : 'false'}">Ingresar</button>
    <button type="button" role="tab" data-mode="register" aria-selected="${mode === 'register' ? 'true' : 'false'}">Crear cuenta</button>
  </div>`;

export function demoBanner() {
  return html`
    <div class="demo-box">
      <div class="alert alert-warning">
        <div>
          <strong><i class="fas fa-flask"></i> Firebase todavía no está configurado</strong><br>
          Completá <code>src/config/firebase.config.js</code> para activar el acceso con Google y correo.
          Mientras tanto podés explorar la app en modo demo (los datos quedan solo en este navegador).
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="demo"><i class="fas fa-play"></i> Entrar en modo demo</button>
      </div>
    </div>`;
}

export function loginView({ demo }) {
  return html`
    <a class="back-home" href="${ROUTES.home}"><i class="fas fa-arrow-left"></i> Volver al inicio</a>
    <h2>Bienvenido de nuevo</h2>
    <p class="sub">Ingresá para acceder a tus liquidaciones.</p>
    ${demo ? demoBanner() : ''}
    ${tabs('login')}
    <div id="auth-alert" role="alert"></div>
    ${googleButton('Continuar con Google')}
    <div class="divider">o con tu correo</div>
    <form class="auth-form" id="form-login" novalidate>
      ${emailField(true)}
      ${passField('password', 'password', 'Contraseña', 'Tu contraseña', 'current-password')}
      <div class="auth-row">
        <label><input type="checkbox" name="remember" checked> Recordar sesión</label>
        <button type="button" class="link-btn" data-mode="reset">¿Olvidaste tu contraseña?</button>
      </div>
      <button type="submit" class="btn btn-primary btn-lg btn-block" id="btn-submit"><span>Ingresar</span><i class="fas fa-arrow-right"></i></button>
    </form>
    <p class="auth-legal">¿Primera vez? <button type="button" class="link-btn" data-mode="register">Creá tu cuenta gratis</button></p>`;
}

export function registerView({ demo }) {
  return html`
    <a class="back-home" href="${ROUTES.home}"><i class="fas fa-arrow-left"></i> Volver al inicio</a>
    <h2>Creá tu cuenta</h2>
    <p class="sub">Gratis, sin tarjeta. Empezá a liquidar en minutos.</p>
    ${demo ? demoBanner() : ''}
    ${tabs('register')}
    <div id="auth-alert" role="alert"></div>
    ${googleButton('Registrarme con Google')}
    <div class="divider">o con tu correo</div>
    <form class="auth-form" id="form-register" novalidate>
      <div class="field">
        <label for="name">Nombre y apellido</label>
        <div class="input-icon">
          <i class="fas fa-user lead"></i>
          <input class="input" id="name" name="name" type="text" placeholder="Ej: María Pérez" autocomplete="name" required>
        </div>
        <span class="error" data-error="name"></span>
      </div>
      ${emailField()}
      <div>
        ${passField('password', 'password', 'Contraseña', 'Mínimo 8 caracteres', 'new-password')}
        <div class="strength" id="strength" data-level="0"><i></i><i></i><i></i><i></i></div>
      </div>
      ${passField('confirm', 'confirm', 'Repetir contraseña', 'Repetí la contraseña', 'new-password')}
      <div class="field">
        <label class="check" style="font-weight:500;color:var(--text)">
          <input type="checkbox" name="terms">
          <span>Acepto los términos de uso y la política de privacidad.</span>
        </label>
        <span class="error" data-error="terms"></span>
      </div>
      <button type="submit" class="btn btn-primary btn-lg btn-block" id="btn-submit"><span>Crear cuenta</span><i class="fas fa-user-plus"></i></button>
    </form>
    <p class="auth-legal">¿Ya tenés cuenta? <button type="button" class="link-btn" data-mode="login">Ingresá</button></p>`;
}

export function resetView() {
  return html`
    <button type="button" class="back-home link-btn" data-mode="login" style="color:var(--text-2)"><i class="fas fa-arrow-left"></i> Volver a ingresar</button>
    <h2>Recuperar contraseña</h2>
    <p class="sub">Te enviaremos un enlace para crear una nueva contraseña.</p>
    <div id="auth-alert" role="alert"></div>
    <form class="auth-form" id="form-reset" novalidate>
      ${emailField(true)}
      <button type="submit" class="btn btn-primary btn-lg btn-block" id="btn-submit"><span>Enviar enlace</span><i class="fas fa-paper-plane"></i></button>
    </form>`;
}

export const alertBox = (type, message) => html`
  <div class="alert alert-${type}" style="margin-bottom:1rem"><i class="fas ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><div>${message}</div></div>`;
