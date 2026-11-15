import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, fillTemplate, whatsappLink, mailtoLink, isEmail, buildMessage, DEFAULT_TEMPLATES } from '../src/services/share.service.js';

test('teléfonos argentinos: normaliza a 549 + área + número', () => {
  const casos = {
    '0261 15-512-3456': '5492615123456',
    '261 5123456': '5492615123456',
    '+54 9 261 512 3456': '5492615123456',
    '54261515123456': '5492615123456',
    '011 15 4444-5555': '5491144445555',
    '11 4444 5555': '5491144445555',
    '(0351) 15 555-1234': '5493515551234',
    '5491144445555': '5491144445555',
  };
  for (const [raw, esperado] of Object.entries(casos)) {
    const r = normalizePhone(raw);
    assert.equal(r.number, esperado, raw);
    assert.ok(r.valid, raw);
  }
});

test('teléfonos: inválidos e internacionales', () => {
  assert.equal(normalizePhone('').valid, false);
  assert.equal(normalizePhone('4512345').valid, false);              // sin código de área
  assert.deepEqual(normalizePhone('+598 99 123 456'), { number: '59899123456', valid: true });
});

test('plantillas: reemplaza variables y limpia espacios', () => {
  assert.equal(fillTemplate('Hola {nombre}, neto {neto}.{x}', { nombre: 'Ana', neto: '$ 10' }), 'Hola Ana, neto $ 10.');
  const m = buildMessage('sueldo', {}, { nombre: 'Ana', periodo: 'Octubre 2026', neto: '$ 1', fecha: '05/11/2026', empresa: 'ACME' });
  assert.match(m.text, /Hola Ana/); assert.match(m.text, /Octubre 2026/); assert.match(m.subject, /ACME/);
  assert.equal(buildMessage('liquidacion', { liquidacion: 'Hola {nombre}' }, { nombre: 'Luis' }).text, 'Hola Luis');
  assert.ok(DEFAULT_TEMPLATES.sueldo.includes('{neto}'));
});

test('enlaces de WhatsApp y correo', () => {
  assert.equal(whatsappLink('0261 15 512 3456', 'Hola & chau').startsWith('https://wa.me/5492615123456?text=Hola%20%26%20chau'), true);
  assert.equal(whatsappLink('', 'x'), 'https://wa.me/?text=x');
  assert.equal(mailtoLink('a@b.com', 'Asunto ñ', 'l1\nl2'), 'mailto:a@b.com?subject=Asunto%20%C3%B1&body=l1%0D%0Al2');
  assert.ok(mailtoLink('malo', 's', 'b').startsWith('mailto:?'));
  assert.ok(isEmail('juan@mail.com') && !isEmail('juan@'));
});
