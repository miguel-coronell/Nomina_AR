/**
 * Adaptador Firestore. Estructura:
 *   users/{uid}                       → perfil + plan
 *   users/{uid}/employees/{id}
 *   users/{uid}/liquidations/{id}
 *   users/{uid}/docs/{name}           → documentos únicos (settings)
 */
import { getFirebase } from '../../core/firebase.js';

const now = () => new Date().toISOString();
// Firestore no admite `undefined`; esto lo elimina.
const clean = (o) => JSON.parse(JSON.stringify(o));

export function createFirestoreAdapter(userId) {
  const ctx = async () => {
    const { db, fsSdk } = await getFirebase();
    return { db, f: fsSdk };
  };

  return {
    kind: 'firestore',

    async list(col) {
      const { db, f } = await ctx();
      const q = f.query(f.collection(db, 'users', userId, col), f.orderBy('createdAt', 'desc'));
      const snap = await f.getDocs(q);
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async get(col, id) {
      const { db, f } = await ctx();
      const snap = await f.getDoc(f.doc(db, 'users', userId, col, id));
      return snap.exists() ? { ...snap.data(), id: snap.id } : null;
    },
    async create(col, data) {
      const { db, f } = await ctx();
      const payload = clean({ ...data, createdAt: now(), updatedAt: now() });
      delete payload.id;
      const ref = await f.addDoc(f.collection(db, 'users', userId, col), payload);
      return { ...payload, id: ref.id };
    },
    async update(col, id, patch) {
      const { db, f } = await ctx();
      const payload = clean({ ...patch, updatedAt: now() });
      delete payload.id;
      await f.setDoc(f.doc(db, 'users', userId, col, id), payload, { merge: true });
      return this.get(col, id);
    },
    async remove(col, id) {
      const { db, f } = await ctx();
      await f.deleteDoc(f.doc(db, 'users', userId, col, id));
    },

    async getDoc(name) {
      const { db, f } = await ctx();
      const snap = await f.getDoc(f.doc(db, 'users', userId, 'docs', name));
      return snap.exists() ? snap.data() : null;
    },
    async setDoc(name, data) {
      const { db, f } = await ctx();
      await f.setDoc(f.doc(db, 'users', userId, 'docs', name), clean(data));
      return data;
    },
    async getRoot() {
      const { db, f } = await ctx();
      const snap = await f.getDoc(f.doc(db, 'users', userId));
      return snap.exists() ? snap.data() : null;
    },
    async setRoot(data) {
      const { db, f } = await ctx();
      await f.setDoc(f.doc(db, 'users', userId), clean(data), { merge: true });
      return data;
    },
    async clearAll() { /* no se borra la nube desde el cliente */ },
  };
}
