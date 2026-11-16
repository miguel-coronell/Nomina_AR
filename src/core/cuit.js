/** Validación de CUIT/CUIL argentino: 11 dígitos con dígito verificador (módulo 11). */
export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function validarCuit(v) {
  const d = soloDigitos(v);
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(d[10]);
}

/** Formato XX-XXXXXXXX-X (si no tiene 11 dígitos, devuelve el texto original). */
export const formatoCuit = (v) => { const d = soloDigitos(v); return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d[10]}` : String(v ?? ''); };
