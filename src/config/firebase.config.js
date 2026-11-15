/**
 * CONFIGURACIÓN DE FIREBASE
 * ---------------------------------------------------------------
 * 1. Entrá a https://console.firebase.google.com y creá un proyecto.
 * 2. Agregá una app Web (</>) y copiá los valores de "firebaseConfig" acá.
 * 3. Authentication → Sign-in method → habilitá "Google" y "Correo/Contraseña".
 * 4. Authentication → Settings → Authorized domains → agregá tu dominio
 *    (localhost ya viene incluido).
 * 5. Firestore Database → Crear base de datos → publicá firestore.rules.
 *
 * Nota: estos valores NO son secretos (van en el navegador). La seguridad
 * real la dan las reglas de Firestore (firestore.rules) y los dominios autorizados.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyAmWb5QRMaZ4400hlxOYQu8c3nZGERk2iI",
  authDomain: "nominas-ar.firebaseapp.com",
  projectId: "nominas-ar",
  storageBucket: "nominas-ar.firebasestorage.app",
  messagingSenderId: "1074259254101",
  appId: "1:1074259254101:web:936195b0040746a9fa6ddc",
  measurementId: "G-16MSKFVPJE"
};

/** true si el archivo ya fue completado con valores reales. */
export function isFirebaseConfigured() {
  const { apiKey, projectId, appId } = firebaseConfig;
  const placeholder = (v) => !v || /^TU_/.test(v);
  return !placeholder(apiKey) && !placeholder(projectId) && !placeholder(appId);
}
