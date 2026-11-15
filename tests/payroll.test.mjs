import test from 'node:test';
import assert from 'node:assert/strict';
import { describirPeriodo, elegible } from '../src/domain/payroll/periodos.js';
import { armarRun, recalcRun, totalesRun, estadoTrasPagos, nuevaLinea, paramsDe } from '../src/domain/payroll/run.js';
import { valorHoraEscala } from '../src/domain/convenios/escalas.js';
import { calcularLinea } from '../src/domain/payroll/engine.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.service.js';

const emp = (o = {}) => ({ id: 'e1', nombre: 'Ana', fechaIngreso: '2020-03-01', sueldo: 1_000_000, periodicidad: 'mensual', adicionalAntiguedadPct: 1, presentismoPct: 8.33, ...o });
const S = { ...DEFAULT_SETTINGS };
const get = (l, id) => l.rubros.find((r) => r.id === id);

test('períodos', () => {
  assert.deepEqual([describirPeriodo({ tipo: 'mensual', year: 2026, month: 2 }).hasta], ['2026-02-28']);
  const q2 = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  assert.equal(q2.desde, '2026-10-16'); assert.equal(q2.hasta, '2026-10-31'); assert.match(q2.label, /2\.ª quincena de Octubre 2026/);
  assert.equal(describirPeriodo({ tipo: 'sac', year: 2026, semestre: 2 }).desde, '2026-07-01');
});

test('mensual: básico + antigüedad + presentismo y aportes', () => {
  const run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp()], S);
  const l = run.lines[0];
  assert.equal(get(l, 'basico').amount, 1_000_000);
  assert.equal(get(l, 'antiguedad').amount, 60_000);            // 6 años × 1%
  assert.equal(get(l, 'presentismo').amount, Math.round(1_060_000 * 0.0833 * 100) / 100);
  const rem = l.totals.remunerativo;
  assert.equal(l.deducciones.find((d) => d.id === 'ap_jubilacion').amount, Math.round(rem * 0.11 * 100) / 100);
  assert.equal(l.totals.neto, Math.round((l.totals.bruto - l.totals.descuentos) * 100) / 100);
  assert.ok(l.totals.costo > l.totals.bruto);
});

test('quincenal paga la mitad y solo incluye empleados quincenales', () => {
  const run = armarRun({ tipo: 'quincenal', year: 2026, month: 10, quincena: 1 }, [emp({ periodicidad: 'quincenal', adicionalAntiguedadPct: 0, presentismoPct: 0 }), emp({ id: 'e2' })], S);
  assert.equal(run.lines.length, 1);
  assert.equal(get(run.lines[0], 'basico').amount, 500_000);
});

test('ingreso a mitad de mes: proporcional por días', () => {
  const run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp({ fechaIngreso: '2026-10-16', adicionalAntiguedadPct: 0, presentismoPct: 0 })], S);
  assert.equal(get(run.lines[0], 'basico').amount, Math.round(1_000_000 * 16 / 31 * 100) / 100);
});

test('egresados antes del período no entran; los que egresan dentro, proporcional', () => {
  const p = describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 });
  assert.equal(elegible(emp({ fechaEgreso: '2026-09-30' }), p), false);
  assert.equal(elegible(emp({ fechaEgreso: '2026-10-10' }), p), true);
  assert.equal(elegible(emp({ fechaIngreso: '2026-11-01' }), p), false);
});

test('novedades: horas extras, ausencias (pierden presentismo), adelanto', () => {
  const p = describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 });
  const base = { ...emp(), fechaIngreso: '2026-01-01' };
  const l = calcularLinea(base, { he50: 10, ausenciasInjustificadas: 2, adelanto: 100_000 }, p, { aportes: S.aportes, patronales: S.patronales, topeRemunerativo: 0 });
  assert.equal(get(l, 'presentismo'), undefined);
  assert.equal(get(l, 'he50').amount, Math.round(1_000_000 / 200 * 1.5 * 10 * 100) / 100);
  assert.equal(l.deducciones.find((d) => d.id === 'ausencias').amount, Math.round(1_000_000 / 30 * 2 * 100) / 100);
  assert.equal(l.deducciones.find((d) => d.id === 'adelanto').amount, 100_000);
  const aj = l.deducciones.find((d) => d.id === 'ap_jubilacion');
  assert.equal(aj.base, Math.round((l.totals.remunerativo - 66_666.67) * 100) / 100);
});

test('no remunerativo: suma al bruto pero no a la base de aportes', () => {
  const p = describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 });
  const l = calcularLinea({ ...emp(), adicionalAntiguedadPct: 0, presentismoPct: 0 }, { noRemunerativo: 200_000 }, p, { aportes: S.aportes, patronales: S.patronales, topeRemunerativo: 0 });
  assert.equal(l.totals.bruto, 1_200_000); assert.equal(l.totals.baseAportes, 1_000_000);
});

test('tope remunerativo limita la base de aportes', () => {
  const p = describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 });
  const l = calcularLinea({ ...emp(), adicionalAntiguedadPct: 0, presentismoPct: 0 }, {}, p, { aportes: S.aportes, patronales: S.patronales, topeRemunerativo: 800_000 });
  assert.equal(l.totals.baseAportes, 800_000);
});

test('SAC: la mitad de la mejor remuneración, proporcional si ingresó en el semestre', () => {
  const full = armarRun({ tipo: 'sac', year: 2026, semestre: 1 }, [emp({ adicionalAntiguedadPct: 0, presentismoPct: 0, fechaIngreso: '2020-01-01' })], S);
  assert.equal(get(full.lines[0], 'sac').amount, 500_000);
  const part = armarRun({ tipo: 'sac', year: 2026, semestre: 1 }, [emp({ adicionalAntiguedadPct: 0, presentismoPct: 0, fechaIngreso: '2026-04-01' })], S);
  assert.equal(get(part.lines[0], 'sac').amount, Math.round(500_000 * 91 / 181 * 100) / 100);
});

test('totales, pagos y estado', () => {
  let run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp(), emp({ id: 'e2', nombre: 'Beto' })], S);
  assert.equal(run.totals.empleados, 2);
  run = { ...run, estado: 'liquidada', lines: run.lines.map((l, i) => (i === 0 ? { ...l, pago: { estado: 'pagado', fecha: '2026-11-04', medio: 'transferencia' } } : l)) };
  const t = totalesRun(run.lines);
  assert.equal(t.pagados, 1); assert.equal(t.pagado + t.pendiente, t.neto);
  assert.equal(estadoTrasPagos(run), 'liquidada');
  run.lines = run.lines.map((l) => ({ ...l, pago: { estado: 'pagado' } }));
  assert.equal(estadoTrasPagos(run), 'pagada');
});

test('liquidada conserva parámetros; borrador toma los vigentes', () => {
  let run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp()], S);
  const nuevo = { ...S, aportes: { ...S.aportes, jubilacion: 20 } };
  assert.equal(recalcRun(run, nuevo).lines[0].deducciones.find((d) => d.id === 'ap_jubilacion').pct, 20);
  run = { ...run, estado: 'liquidada' };
  assert.equal(recalcRun(run, nuevo).lines[0].deducciones.find((d) => d.id === 'ap_jubilacion').pct, 11);
});

import { costoLaboral } from '../src/domain/payroll/costo.js';
test('costo laboral: las porciones suman el costo total y respetan el desglose', () => {
  const run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp()], S);
  const l = run.lines[0];
  const c = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias, deducciones: l.deducciones, patronales: run.params.patronales });
  assert.equal(Math.round(c.slices.reduce((a, s) => a + s.monto, 0) * 100) / 100, c.costoTotal);
  assert.equal(c.costoTotal, l.totals.costo);
  assert.equal(c.totalContribuciones, l.totals.patronal);
  assert.ok(c.filas.find((f) => f.rubro === 'Seguridad social').contribucion > 0);
  assert.ok(Math.abs(c.slices.reduce((a, s) => a + s.pct, 0) - 100) < 0.01);
});

test('conceptos con cantidad, unidad y base de cálculo (Decreto 407/2026)', () => {
  const l = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp()], S).lines[0];
  const b = get(l, 'basico'); assert.deepEqual([b.cant, b.unidad, b.base], [30, 'días', 1_000_000]);
  assert.equal(get(l, 'presentismo').unidad, '%');
  const h = calcularLinea({ ...emp(), fechaIngreso: '2026-01-01' }, { he50: 10 }, describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 }), { aportes: S.aportes, patronales: S.patronales, topeRemunerativo: 0 });
  assert.equal(get(h, 'he50').unidad, 'hs');
});

test('pasantía: asignación no remunerativa, sin aportes, contribuciones solo obra social y ART; sin SAC', () => {
  const pas = { ...emp({ id: 'p1', nombre: 'Pasante', regimen: 'pasantia', sueldo: 500_000, adicionalAntiguedadPct: 0, presentismoPct: 0 }) };
  const run = armarRun({ tipo: 'mensual', year: 2026, month: 10, todos: true }, [pas], S);
  const l = run.lines[0];
  assert.deepEqual(l.rubros.map((r) => [r.id, r.tipo]), [['asignacion', 'no_remunerativo']]);
  assert.equal(l.deducciones.filter((d) => /^ap_/.test(d.id)).length, 0);
  assert.equal(l.totals.neto, 500_000);
  assert.equal(l.totals.patronal, Math.round(500_000 * (S.patronales.obraSocial + S.patronales.art)) / 100);
  assert.equal(armarRun({ tipo: 'sac', year: 2026, semestre: 2 }, [pas, emp()], S).lines.length, 1);
});

test('feriado trabajado, licencia sin goce y horas a descontar', () => {
  const p = describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 });
  const params = { aportes: S.aportes, patronales: S.patronales, topeRemunerativo: 0, divisorFeriado: 25 };
  const snap = { ...emp({ fechaIngreso: '2020-01-01', adicionalAntiguedadPct: 0, presentismoPct: 0 }), divisorHora: 150 };
  const l = calcularLinea(snap, { feriadosTrabajados: 1, sinGoce: 2, hsDescontar: 3 }, p, params);
  assert.equal(get(l, 'feriado').amount, 40_000);                          // 1.000.000 / 25
  assert.equal(l.deducciones.find((d) => d.id === 'sin_goce').amount, 66_666.67);
  assert.equal(l.deducciones.find((d) => d.id === 'hs_desc').amount, 20_000); // 3 × (1.000.000 / 150)
});


test('personal por hora (UOCRA): valor hora de la escala × horas trabajadas, como el recibo real', () => {
  const e = emp({ id: 'h1', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: 56 });
  const bas = l.rubros.find((r) => r.id === 'basico');
  assert.equal(bas.amount, 340_760);                       // 56 hs × $6.085
  assert.deepEqual([bas.cant, bas.unidad, bas.base], [56, 'hs', 6085]);
  assert.equal(l.rubros.find((r) => r.id === 'presentismo').amount, 68_152);   // 20 %
  assert.equal(l.totals.remunerativo, 408_912);
  assert.equal(l.deducciones.find((d) => d.id === 'ap_jubilacion').amount, 44_980.32);
  assert.equal(l.deducciones.find((d) => d.id === 'sindicato').amount, 10_222.8);
  assert.equal(l.totals.neto % 1, 0);                      // el redondeo deja el neto en pesos enteros
  assert.ok(Math.abs(l.totals.neto - 306_306) < 1);
});
test('la escala toma la vigencia del período y respeta la zona', () => {
  assert.equal(valorHoraEscala('construccion', 'Medio Oficial', 'A', '2026-10-20'), 6085);
  assert.equal(valorHoraEscala('construccion', 'medio oficial', 'A', '2026-11-05'), 6188);
  assert.equal(valorHoraEscala('construccion', 'Oficial', 'B', '2026-10-20'), 7313);
  assert.equal(valorHoraEscala('construccion', 'Oficial', 'A', '2026-01-01'), null);
});
