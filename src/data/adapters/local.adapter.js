/**
 * Adaptador localStorage. Misma interfaz que el de Firestore.
 * Se usa en modo demo y como respaldo si Firebase no está disponible.
 */
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
const now = () => new Date().toISOString();

export function createLocalAdapter(userId) {
  const key = (name) => `al:${userId}:${name}`;
  const read = (name, fallback) => {
    try { return JSON.parse(localStorage.getItem(key(name))) ?? fallback; } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));

  return {
    kind: 'local',

    async list(col) {
      return read(col, []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async get(col, id) {
      return read(col, []).find((x) => x.id === id) || null;
    },
    async create(col, data) {
      const items = read(col, []);
      const item = { ...data, id: uid(), createdAt: now(), updatedAt: now() };
      items.push(item);
      write(col, items);
      return item;
    },
    async update(col, id, patch) {
      const items = read(col, []);
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) throw new Error('NOT_FOUND');
      items[i] = { ...items[i], ...patch, id, updatedAt: now() };
      write(col, items);
      return items[i];
    },
    async remove(col, id) {
      write(col, read(col, []).filter((x) => x.id !== id));
    },

    // Documentos únicos (settings) y documento raíz del usuario (perfil / plan)
    async getDoc(name) { return read(`doc:${name}`, null); },
    async setDoc(name, data) { write(`doc:${name}`, data); return data; },
    async getRoot() { return read('root', null); },
    async setRoot(data) { const merged = { ...read('root', {}), ...data }; write('root', merged); return merged; },

    async clearAll() {
      Object.keys(localStorage).filter((k) => k.startsWith(`al:${userId}:`)).forEach((k) => localStorage.removeItem(k));
    },
  };
}
