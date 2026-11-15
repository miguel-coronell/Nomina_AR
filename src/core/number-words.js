/** Número a letras en español (para "Son pesos ..." en los recibos). */
const U = ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const D = ['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const C = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

function hasta999(n) {
  if (n === 100) return 'cien';
  if (n < 30) return U[n];
  if (n < 100) { const d = Math.floor(n / 10), u = n % 10; return D[d] + (u ? ' y ' + U[u] : ''); }
  const c = Math.floor(n / 100), r = n % 100;
  return C[c] + (r ? ' ' + hasta999(r) : '');
}

const apocopar = (t) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

function entero(n) {
  if (n === 0) return 'cero';
  const partes = [];
  const billones = Math.floor(n / 1e12);
  const millones = Math.floor((n % 1e12) / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  if (billones) partes.push(billones === 1 ? 'un billón' : apocopar(entero(billones)) + ' billones');
  if (millones) partes.push(millones === 1 ? 'un millón' : apocopar(entero(millones)) + ' millones');
  if (miles) partes.push(miles === 1 ? 'mil' : apocopar(hasta999(miles)) + ' mil');
  if (resto) partes.push(hasta999(resto));
  return partes.join(' ');
}

export function montoEnLetras(monto) {
  const v = Math.round((+monto || 0) * 100) / 100;
  const ent = Math.floor(v);
  const cent = Math.round((v - ent) * 100);
  return `Son pesos ${entero(ent)} con ${String(cent).padStart(2, '0')}/100.`;
}
