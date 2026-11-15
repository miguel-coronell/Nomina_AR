/**
 * Carga perezosa del SDK de Firebase (modular v10 desde CDN de Google).
 * Solo se descarga cuando Firebase está configurado, así el modo demo
 * funciona sin conexión a los servidores de Google.
 */
import { firebaseConfig, isFirebaseConfigured } from '../config/firebase.config.js';

const VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${VERSION}`;
let cached;

export function getFirebase() {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('FIREBASE_NOT_CONFIGURED'));
  if (!cached) {
    cached = (async () => {
      const [appSdk, authSdk, fsSdk] = await Promise.all([
        import(`${CDN}/firebase-app.js`),
        import(`${CDN}/firebase-auth.js`),
        import(`${CDN}/firebase-firestore.js`),
      ]);
      const app = appSdk.initializeApp(firebaseConfig);
      return { app, auth: authSdk.getAuth(app), db: fsSdk.getFirestore(app), authSdk, fsSdk };
    })();
    cached.catch(() => { cached = undefined; });
  }
  return cached;
}
