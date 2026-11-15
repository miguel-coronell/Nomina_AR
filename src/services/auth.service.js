/**
 * Servicio de autenticación.
 *  - Con Firebase configurado: Google + correo/contraseña reales.
 *  - Sin configurar: "modo demo" local para poder explorar la app.
 */
import { isFirebaseConfigured } from '../config/firebase.config.js';
import { getFirebase } from '../core/firebase.js';

const DEMO_KEY = 'al:demo-user';
const listeners = new Set();

export const authMode = () => (isFirebaseConfigured() ? 'firebase' : 'demo');

const normalize = (u) => u && ({
  uid: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'Usuario',
  email: u.email || '',
  photoURL: u.photoURL || '',
  emailVerified: !!u.emailVerified,
  provider: u.providerData?.[0]?.providerId || 'password',
  isDemo: false,
});

const demoUser = () => {
  try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; }
};

/** Suscribe a cambios de sesión. Devuelve la función para desuscribirse. */
export function onAuthChange(cb) {
  if (authMode() === 'demo') {
    listeners.add(cb);
    cb(demoUser());
    return () => listeners.delete(cb);
  }
  let unsub = () => {};
  let cancelled = false;
  getFirebase().then(({ auth, authSdk }) => {
    if (cancelled) return;
    unsub = authSdk.onAuthStateChanged(auth, (u) => cb(normalize(u)));
  }).catch(() => cb(null));
  return () => { cancelled = true; unsub(); };
}

/** Espera al primer estado de sesión conocido. */
export const currentUser = () => new Promise((resolve) => {
  const off = onAuthChange((u) => { resolve(u); queueMicrotask(() => off()); });
});

export async function signInWithGoogle() {
  const { auth, authSdk } = await getFirebase();
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const cred = await authSdk.signInWithPopup(auth, provider);
    return normalize(cred.user);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked') {
      await authSdk.signInWithRedirect(auth, provider);
      return null; // la página se recarga
    }
    throw err;
  }
}

export async function signInWithEmail(email, password, remember = true) {
  const { auth, authSdk } = await getFirebase();
  await authSdk.setPersistence(auth, remember ? authSdk.browserLocalPersistence : authSdk.browserSessionPersistence);
  const cred = await authSdk.signInWithEmailAndPassword(auth, email, password);
  return normalize(cred.user);
}

export async function registerWithEmail({ name, email, password }) {
  const { auth, authSdk } = await getFirebase();
  const cred = await authSdk.createUserWithEmailAndPassword(auth, email, password);
  if (name) await authSdk.updateProfile(cred.user, { displayName: name });
  try { await authSdk.sendEmailVerification(cred.user); } catch { /* no bloquea el alta */ }
  return normalize({ ...cred.user, displayName: name || cred.user.displayName });
}

export async function sendPasswordReset(email) {
  const { auth, authSdk } = await getFirebase();
  await authSdk.sendPasswordResetEmail(auth, email);
}

export async function updateDisplayName(name) {
  if (authMode() === 'demo') {
    const u = demoUser(); if (u) { u.name = name; localStorage.setItem(DEMO_KEY, JSON.stringify(u)); }
    return;
  }
  const { auth, authSdk } = await getFirebase();
  if (auth.currentUser) await authSdk.updateProfile(auth.currentUser, { displayName: name });
}

export function enterDemoMode() {
  const user = { uid: 'demo', name: 'Usuario Demo', email: 'demo@argenliquid.local', photoURL: '', emailVerified: true, provider: 'demo', isDemo: true };
  localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  listeners.forEach((cb) => cb(user));
  return user;
}

export async function signOut() {
  if (authMode() === 'demo') {
    localStorage.removeItem(DEMO_KEY);
    listeners.forEach((cb) => cb(null));
    return;
  }
  const { auth, authSdk } = await getFirebase();
  await authSdk.signOut(auth);
}

/** Traduce códigos de error de Firebase a mensajes claros en español. */
export function authErrorMessage(err) {
  const code = err?.code || err?.message || '';
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Probá iniciar sesión.',
    'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).',
    'auth/missing-password': 'Ingresá tu contraseña.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
    'auth/network-request-failed': 'Sin conexión. Revisá tu internet e intentá de nuevo.',
    'auth/user-disabled': 'Esta cuenta fue deshabilitada. Contactá a soporte.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se canceló el inicio de sesión con Google.',
    'auth/popup-blocked': 'Tu navegador bloqueó la ventana emergente de Google.',
    'auth/account-exists-with-different-credential': 'Ese correo ya está registrado con otro método de acceso.',
    'auth/operation-not-allowed': 'Este método de acceso no está habilitado en Firebase (Authentication → Sign-in method).',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).',
    'auth/configuration-not-found': 'Falta activar Authentication en tu proyecto de Firebase.',
    'FIREBASE_NOT_CONFIGURED': 'Firebase todavía no está configurado (src/config/firebase.config.js).',
  };
  return map[code] || 'Ocurrió un error inesperado. Intentá de nuevo.';
}
