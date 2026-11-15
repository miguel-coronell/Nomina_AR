/**
 * Búsqueda tolerante: ignora mayúsculas, tildes y puntuación; todas las palabras
 * escritas deben aparecer en alguno de los campos (nombre, legajo, DNI, CUIL…).
 *   const match = matcher('perez 3012');  match(e.nombre, e.dni, e.legajo) → boolean
 */
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function matcher(query) {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return () => true;
  return (...fields) => {
    const text = fields.map(fold).join(' ');
    const compact = text.replace(/[^a-z0-9 ]/g, '');
    return tokens.every((t) => text.includes(t) || compact.includes(t.replace(/[^a-z0-9]/g, '')));
  };
}
