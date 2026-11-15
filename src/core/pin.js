/** PIN de fichaje: se guarda solo su hash (SHA-256 con sal), nunca el número. */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(12)));
export const pinValido = (pin) => /^\d{4,6}$/.test(String(pin || ''));

export async function hashPin(pin, salt) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)));
}
export async function verificarPin(emp, pin) {
  if (!emp?.pinHash || !emp?.pinSalt) return false;
  return (await hashPin(String(pin), emp.pinSalt)) === emp.pinHash;
}
