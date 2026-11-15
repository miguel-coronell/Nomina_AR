import test from 'node:test';
import assert from 'node:assert/strict';
import { feriadosDelAnio } from '../src/domain/hr/feriados.js';
import { normalizarHorario, horasSemanales, divisorHoraDe, horasPactadas, horarioTexto } from '../src/domain/hr/horario.js';
import { evaluarDia, resumenPeriodo, novedadesDesdeResumen } from '../src/domain/hr/asistencia.js';
import { diasVacaciones, saldoVacaciones } from '../src/domain/hr/vacaciones.js';

const F = feriadosDelAnio(2026);
const emp = (o = {}) => ({ regimen: 'dependencia', horario: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 4 }, ...o });

test('feriados 2026: incluye 9/11 (visita del Papa), 23/11 trasladado y no laborables', () => {
  assert.equal(F.get('2026-11-09').tipo, 'feriado');
  assert.equal(F.get('2026-11-23').tipo, 'feriado');
  assert.equal(F.get('2026-12-07').tipo, 'no_laborable');
  assert.equal(F.has('2026-11-20'), false);
  assert.equal([...F.values()].filter((v) => v.tipo === 'feriado').length, 17);
});
test('feriados: otros años solo fijos, y ajustes del usuario', () => {
  const y = feriadosDelAnio(2027, { custom: [{ fecha: '2027-03-22', nombre: 'Prueba', tipo: 'no_laborable' }], removidos: ['2027-12-25'] });
  assert.ok(y.has('2027-05-01')); assert.ok(!y.has('2027-12-25')); assert.equal(y.get('2027-03-22').tipo, 'no_laborable');
});

test('horario variable: 4 hs el viernes, divisor proporcional', () => {
  const h = normalizarHorario({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 4 });
  assert.equal(horasSemanales(h), 36); assert.equal(horasPactadas(h, '2026-10-30'), 4); // viernes
  assert.equal(divisorHoraDe({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 8 }), 200);
  assert.equal(divisorHoraDe(h), 150); assert.equal(divisorHoraDe(h, 180), 180);
  assert.match(horarioTexto(h), /Vie 4 h/);
});

test('día común: extras al 50 %, sábado al 100 %, faltante cuando trabaja menos', () => {
  const lunes = evaluarDia(emp(), '2026-10-26', { t: 'T', h: 10 });
  assert.deepEqual([lunes.normales, lunes.he50, lunes.he100], [8, 2, 0]);
  const viernes = evaluarDia(emp(), '2026-10-30', { t: 'T', h: 6 }); // pactado 4 hs
  assert.equal(viernes.he50, 2);
  const corto = evaluarDia(emp(), '2026-10-27', { t: 'T', h: 6 });
  assert.equal(corto.faltante, 2);
  const sabado = evaluarDia(emp(), '2026-10-31', { t: 'T', h: 3 });
  assert.deepEqual([sabado.he50, sabado.he100], [0, 3]);
  assert.equal(evaluarDia(emp(), '2026-10-31', { t: 'T', h: 3, rec: '50' }).he50, 3);
});

test('feriado trabajado: día adicional + extras al 100 %; domingo todo al 100 %', () => {
  const fer = evaluarDia(emp(), '2026-10-12', { t: 'T', h: 9 }, F.get('2026-10-12')); // lunes feriado, pactado 8
  assert.deepEqual([fer.feriadoTrab, fer.normales, fer.he100], [1, 8, 1]);
  const dom = evaluarDia(emp(), '2026-10-25', { t: 'T', h: 5 });
  assert.equal(dom.he100, 5);
});

test('banco de horas: las extras no se pagan, se acumulan; el franco las consume', () => {
  const e = emp({ bancoHoras: true });
  const d = evaluarDia(e, '2026-10-26', { t: 'T', h: 10 });
  assert.deepEqual([d.he50, d.he100, d.bancoGen], [0, 0, 2]);
  assert.equal(evaluarDia(e, '2026-10-27', { t: 'BH', h: 2 }).bancoUsado, 2);
});

test('resumen del período y novedades de nómina', () => {
  const days = {
    '2026-10-12': { t: 'T', h: 8 }, '2026-10-13': { t: 'T', h: 10 }, '2026-10-14': { t: 'FI' }, '2026-10-15': { t: 'FJ' },
    '2026-10-16': { t: 'L', l: 'vacaciones' }, '2026-10-17': { t: 'L', l: 'vacaciones' }, '2026-10-19': { t: 'SG' }, '2026-10-20': { t: 'T', h: 6 },
  };
  const r = resumenPeriodo(emp(), '2026-10-12', '2026-10-20', days, F);
  assert.equal(r.feriadosTrab, 1); assert.equal(r.he50, 2); assert.equal(r.faltasInj, 1); assert.equal(r.faltasJust, 1);
  assert.equal(r.vacaciones, 2); assert.equal(r.sinGoce, 1); assert.equal(r.hsFaltantes, 2);
  const nov = novedadesDesdeResumen(r, { descontarHoras: true });
  assert.deepEqual([nov.he50, nov.ausenciasInjustificadas, nov.sinGoce, nov.feriadosTrabajados, nov.hsDescontar], [2, 1, 1, 1, 2]);
});

test('pasantía: avisos por más de 6,5 hs diarias y 20 semanales', () => {
  const p = emp({ regimen: 'pasantia', horario: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4 } });
  const r = resumenPeriodo(p, '2026-10-26', '2026-10-30', { '2026-10-26': { t: 'T', h: 7 }, '2026-10-27': { t: 'T', h: 6 }, '2026-10-28': { t: 'T', h: 6 }, '2026-10-29': { t: 'T', h: 4 }, '2026-10-30': { t: 'T', h: 4 } }, F);
  assert.ok(r.avisos.some((a) => /6,5|6\.5/.test(a)) && r.avisos.some((a) => /semanales/.test(a)));
});

test('vacaciones: 14/21/28/35 por antigüedad y proporcional el primer año', () => {
  assert.equal(diasVacaciones('2024-01-10', 2026), 14); assert.equal(diasVacaciones('2020-01-10', 2026), 21);
  assert.equal(diasVacaciones('2012-01-10', 2026), 28); assert.equal(diasVacaciones('2000-01-10', 2026), 35);
  assert.equal(diasVacaciones('2026-10-01', 2026), 4); // 1 día cada 20 trabajados, redondeo al alza
  const s = saldoVacaciones({ fechaIngreso: '2020-01-10' }, 2026, [{ '2026-01-05': { t: 'L', l: 'vacaciones' }, '2026-01-06': { t: 'L', l: 'vacaciones' }, '2026-02-02': { t: 'L', l: 'enfermedad' } }]);
  assert.deepEqual([s.correspondientes, s.tomadas, s.saldo], [21, 2, 19]);
});

import { horasDe, duracionMin, turnoAbierto, aMinutos, marcacionesTexto } from '../src/domain/hr/horas.js';
test('horas a partir de entrada y salida: turno simple, cortado, nocturno y descanso', () => {
  assert.equal(horasDe({ t: 'T', i: [['08:00', '17:00']] }), 9);
  assert.equal(horasDe({ t: 'T', i: [['08:00', '17:00']] }, 60), 8);               // descanso no remunerado de 1 h
  assert.equal(horasDe({ t: 'T', i: [['08:02', '12:00'], ['13:00', '17:30']] }), 8.47); // turno cortado: el hueco no cuenta
  assert.equal(horasDe({ t: 'T', i: [['22:00', '06:00']] }), 8);                    // cruza la medianoche
  assert.equal(horasDe({ t: 'T', i: [['08:00', null]] }), 0);                       // salida pendiente
  assert.equal(turnoAbierto({ i: [['08:00', null]] }), true);
  assert.equal(horasDe({ t: 'T', h: 6.5 }), 6.5);                                   // carga manual
  assert.equal(duracionMin('25:00', '10:00'), null); assert.equal(aMinutos('8:5'), null);
  assert.equal(marcacionesTexto({ i: [['08:00', '12:00'], ['13:00', null]] }), '08:00 → 12:00 · 13:00 → …');
});
test('extras calculadas desde las marcaciones y turnos abiertos avisados', () => {
  const e = emp({ descansoMin: 60 });
  const lunes = evaluarDia(e, '2026-10-26', { t: 'T', i: [['08:00', '18:00']] });      // 10 hs - 1 h de descanso = 9 → 1 extra
  assert.deepEqual([lunes.horas, lunes.normales, lunes.he50], [9, 8, 1]);
  const r = resumenPeriodo(e, '2026-10-26', '2026-10-27', { '2026-10-26': { t: 'T', i: [['08:00', '16:00']] }, '2026-10-27': { t: 'T', i: [['08:00', null]] } }, F);
  assert.equal(r.abiertos, 1); assert.ok(r.avisos.some((a) => /sin salida/.test(a))); assert.equal(r.hsPactadas, 16);
});
test('aviso cuando un día supera 16 horas por una marcación dudosa', () => {
  const r = resumenPeriodo(emp(), '2026-10-26', '2026-10-26', { '2026-10-26': { t: 'T', i: [['08:00', '07:00']] } }, F);
  assert.ok(r.avisos.some((a) => /Revisá las marcaciones/.test(a)));
});
