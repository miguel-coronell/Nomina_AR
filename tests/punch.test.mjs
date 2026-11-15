import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceService } from '../src/services/attendance.service.js';
import { createEmployeesService } from '../src/services/employees.service.js';
import { verificarPin } from '../src/core/pin.js';

const memRepo = () => { const docs = new Map(), cols = new Map(); return {
  getDoc: async (k) => docs.get(k) || null, setDoc: async (k, v) => { docs.set(k, JSON.parse(JSON.stringify(v))); },
  list: async (c) => cols.get(c) || [], get: async (c, id) => (cols.get(c) || []).find((x) => x.id === id) || null,
  create: async (c, d) => { const x = { ...d, id: String((cols.get(c) || []).length + 1) }; cols.set(c, [...(cols.get(c) || []), x]); return x; },
  update: async (c, id, p) => { const l = cols.get(c); const i = l.findIndex((x) => x.id === id); l[i] = { ...l[i], ...p }; return l[i]; } }; };
const at = (s) => new Date(s);

test('fichaje: entrada, salida, turno cortado y doble marcación', async () => {
  const a = createAttendanceService(memRepo());
  let r = await a.punch('e1', at('2026-10-26T08:02:00')); assert.deepEqual([r.tipo, r.hora], ['entrada', '08:02']);
  await assert.rejects(a.punch('e1', at('2026-10-26T08:02:30')), (e) => e.code === 'DOBLE');
  r = await a.punch('e1', at('2026-10-26T12:00:00')); assert.equal(r.tipo, 'salida');
  r = await a.punch('e1', at('2026-10-26T13:01:00')); assert.equal(r.tipo, 'entrada');
  r = await a.punch('e1', at('2026-10-26T17:30:00')); assert.deepEqual(r.rec.i, [['08:02', '12:00'], ['13:01', '17:30']]);
  const dia = (await a.getEmployeeMonth(2026, 10, 'e1'))['2026-10-26'];
  assert.equal(dia.t, 'T'); assert.equal(dia.i.length, 2);
});

test('fichaje nocturno: la salida de madrugada cierra el turno de ayer', async () => {
  const a = createAttendanceService(memRepo());
  await a.punch('e2', at('2026-10-26T22:00:00'));
  const r = await a.punch('e2', at('2026-10-27T06:05:00'));
  assert.deepEqual([r.tipo, r.nocturno, r.iso], ['salida', true, '2026-10-26']);
  assert.deepEqual((await a.getEmployeeMonth(2026, 10, 'e2'))['2026-10-26'].i, [['22:00', '06:05']]);
});

test('fichaje: no pisa licencias ni horas cargadas a mano; presentes de hoy', async () => {
  const a = createAttendanceService(memRepo());
  await a.saveEmployeeMonth(2026, 10, 'e3', { '2026-10-26': { t: 'L', l: 'vacaciones' }, '2026-10-27': { t: 'T', h: 8 } });
  await assert.rejects(a.punch('e3', at('2026-10-26T08:00:00')), (e) => e.code === 'OTRO_REGISTRO');
  await assert.rejects(a.punch('e3', at('2026-10-27T08:00:00')), (e) => e.code === 'HORAS_MANUALES');
  await a.punch('e4', at('2026-10-28T09:00:00'));
  const h = await a.hoy(at('2026-10-28T10:00:00')); assert.ok(h.e4 && !h.e3);
});

test('PIN: se guarda solo el hash y se verifica', async () => {
  const repo = memRepo(); const es = createEmployeesService(repo);
  const e = await es.save({ nombre: 'Ana Gómez', fechaIngreso: '2022-01-01', sueldo: 100000 });
  const c = await es.setPin(e.id, '4321');
  assert.ok(c.pinHash && !JSON.stringify(c).includes('4321'));
  assert.equal(await verificarPin(c, '4321'), true); assert.equal(await verificarPin(c, '1234'), false);
  await assert.rejects(es.setPin(e.id, '12'), (x) => !!x.errors.pin);
  const g = await es.save({ ...e, nombre: 'Ana G.' }); assert.ok((await repo.get('employees', e.id)).pinHash, 'guardar la ficha no borra el PIN');
});
