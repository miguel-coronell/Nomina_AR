/**
 * Fábrica de repositorio: elige el adaptador según el usuario/entorno.
 * Los servicios solo conocen esta interfaz, nunca Firestore o localStorage.
 */
import { createLocalAdapter } from './adapters/local.adapter.js';
import { createFirestoreAdapter } from './adapters/firestore.adapter.js';

export function createRepository(user) {
  return user.isDemo ? createLocalAdapter(user.uid) : createFirestoreAdapter(user.uid);
}
