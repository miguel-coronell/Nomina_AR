/**
 * Compartir recibos de haberes y liquidaciones finales por WhatsApp o correo.
 * Lógica pura (sin DOM): normalización de teléfonos argentinos, plantillas de mensaje y enlaces.
 *
 * Nota: ni WhatsApp (wa.me) ni mailto: permiten adjuntar archivos automáticamente. El mensaje
 * se envía por el canal elegido y el PDF se comparte aparte (Web Share en el celular o descarga).
 */

export const PLACEHOLDERS = [
  ['nombre', 'Nombre del empleado'],
  ['periodo', 'Período de la nómina'],
  ['neto', 'Importe neto'],
  ['fecha', 'Fecha de pago / de egreso'],
  ['motivo', 'Motivo de egreso'],
  ['empresa', 'Tu empresa o estudio'],
];

export const DEFAULT_TEMPLATES = {
  sueldo:
    'Hola {nombre}, ¿cómo estás? Te compartimos tu recibo de haberes de {periodo}.\n\n'
    + 'Neto a cobrar: {neto}\nFecha de pago: {fecha}\n\n'
    + 'Ante cualquier consulta, escribinos. ¡Saludos!\n{empresa}',
  liquidacion:
    'Hola {nombre}, te compartimos tu liquidación final.\n\n'
    + 'Motivo: {motivo}\nFecha de egreso: {fecha}\nTotal neto a cobrar: {neto}\n\n'
    + 'Ante cualquier consulta, escribinos. ¡Saludos!\n{empresa}',
};

export const DEFAULT_SUBJECTS = {
  sueldo: 'Recibo de haberes {periodo} — {empresa}',
  liquidacion: 'Liquidación final — {empresa}',
};

/** Reemplaza {variable} por su valor; las variables sin dato quedan vacías. */
export const fillTemplate = (tpl, vars = {}) =>
  String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Normaliza un teléfono argentino al formato de WhatsApp: 549 + código de área + número (sin 0 ni 15).
 * Acepta formatos como "0261 15-512-3456", "261 5123456", "+54 9 261 512 3456" o "54261515123456".
 * Los números internacionales (con "+" y otro país) se respetan tal cual.
 * @returns {{ number: string, valid: boolean }}
 */
export function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  let d = text.replace(/\D/g, '');
  if (!d) return { number: '', valid: false };
  if (text.startsWith('+') && !d.startsWith('54')) return { number: d, valid: d.length >= 8 && d.length <= 15 };
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);       // ya venía en formato móvil (9 + área + número)
  if (d.length === 12) {                                           // área + "15" + número
    for (const a of [2, 3, 4]) if (d.slice(a, a + 2) === '15') { d = d.slice(0, a) + d.slice(a + 2); break; }
  }
  return d.length === 10 ? { number: `549${d}`, valid: true } : { number: d, valid: false };
}

/** "5492615123456" → "+54 9 2615123456" (solo para mostrar). */
export function prettyPhone({ number, valid }) {
  if (!number) return '';
  return valid && number.startsWith('549') ? `+54 9 ${number.slice(3)}` : `+${number}`;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

/** Enlace de WhatsApp. Sin teléfono válido abre WhatsApp para elegir el contacto. */
export function whatsappLink(phone, text) {
  const n = normalizePhone(phone);
  return `https://wa.me/${n.valid ? n.number : ''}?text=${encodeURIComponent(text || '')}`;
}

/** Enlace mailto: (saltos de línea como CRLF, que es lo que esperan los clientes de correo). */
export function mailtoLink(email, subject, body) {
  const crlf = String(body || '').replace(/\r?\n/g, '\r\n');
  return `mailto:${isEmail(email) ? email.trim() : ''}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(crlf)}`;
}

/** Texto de Plantilla + variables según el tipo de documento. */
export function buildMessage(kind, templates, vars) {
  const tpl = (templates && templates[kind]) || DEFAULT_TEMPLATES[kind];
  return {
    text: fillTemplate(tpl, vars),
    subject: fillTemplate(DEFAULT_SUBJECTS[kind], vars),
  };
}
