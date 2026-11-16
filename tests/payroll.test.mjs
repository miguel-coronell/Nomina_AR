import test from 'node:test';
import assert from 'node:assert/strict';
import { describirPeriodo, elegible } from '../src/domain/payroll/periodos.js';
import { armarRun, recalcRun, totalesRun, estadoTrasPagos, nuevaLinea, paramsDe } from '../src/domain/payroll/run.js';
import { valorHoraEscala } from '../src/domain/convenios/escalas.js';
import { calcularLinea, patronalesDe, diasTrabajadosMes } from '../src/domain/payroll/engine.js';
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

test('ingreso a mitad de mes: proporcional por días hábiles (lun-vie sin feriados)', () => {
  const run = armarRun({ tipo: 'mensual', year: 2026, month: 10 }, [emp({ fechaIngreso: '2026-10-16', adicionalAntiguedadPct: 0, presentismoPct: 0 })], S);
  assert.equal(get(run.lines[0], 'basico').amount, Math.round(1_000_000 * 11 / 21 * 100) / 100);   // 11 de 21 días hábiles de octubre 2026
  assert.ok(run.lines[0].warnings.some((w) => /11 de 21 días hábiles/.test(w)));
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
  const c = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias, deducciones: l.deducciones, patronales: l.patronales });
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
  // 408.912 supera el piso de obra social (2 × 146.759,98 = 293.519,96): no hay obra social adicional
  assert.equal(l.deducciones.find((d) => d.id === 'os_adic'), undefined);
  assert.equal(l.deducciones.find((d) => d.id === 'seguro_vida').amount, 20_349.7);   // 2 % de 1.017.485 (Sereno Zona A)
  assert.equal(l.totals.descuentos, 100_087.54);
  assert.equal(l.rubros.find((r) => r.id === 'redondeo').amount, 0.54);
  assert.equal(l.totals.neto, 308_825);
});
test('jornalero: obra social adicional solo completa la base mínima; no afiliado paga aporte solidario', () => {
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const e = emp({ id: 'h2', modalidad: 'hora', convenio: 'construccion', categoria: 'Ayudante', zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: false, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: 10 });      // 10 × 5.601 = 56.010 (< base mínima)
  const os = l.deducciones.find((d) => d.id === 'os_adic');
  assert.equal(os.amount, 7_125.3);   // 3 % × (293.519,96 − 56.010), mes completo (30 días)
  assert.equal(l.deducciones.find((d) => d.id === 'sindicato'), undefined);
  assert.equal(l.deducciones.find((d) => d.id === 'solidario').amount, 1_120.2); // 2 % de 56.010
});
test('resumen de costo laboral: el neto coincide con el neto del recibo (jornalero)', () => {
  const e = emp({ id: 'h3', modalidad: 'hora', convenio: 'construccion', categoria: 'Ayudante', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  for (const hs of [10, 56]) {                       // con y sin obra social adicional
    const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: hs });
    const c = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias, deducciones: l.deducciones, patronales: patronalesDe(l.snap, paramsDe(S)) });
    assert.equal(c.netoTrabajador, l.totals.neto);
    assert.equal(c.totalAportes, l.totals.descuentos);
    assert.equal(c.costoTotal, l.totals.costo);
  }
});
test('CUIT: 11 dígitos con dígito verificador', async () => {
  const { validarCuit, formatoCuit } = await import('../src/core/cuit.js');
  assert.equal(validarCuit('20-12345678-6'), true);
  assert.equal(validarCuit('9823682753872'), false);   // 13 dígitos
  assert.equal(validarCuit('20-12345678-5'), false);   // dígito verificador incorrecto
  assert.equal(formatoCuit('20123456786'), '20-12345678-6');
});
test('la escala toma la vigencia del período y respeta la zona', () => {
  assert.equal(valorHoraEscala('construccion', 'Medio Oficial', 'A', '2026-10-20'), 6085);
  assert.equal(valorHoraEscala('construccion', 'medio oficial', 'A', '2026-11-05'), 6188);
  assert.equal(valorHoraEscala('construccion', 'Oficial', 'B', '2026-10-20'), 7313);
  assert.equal(valorHoraEscala('construccion', 'Oficial', 'A', '2026-01-01'), null);
});

test('jornalero que ingresa el 21/10: 8 días × 8 hs = 64 hs; liquidación con 64 hs', () => {
  const e = emp({ id: 'h4', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-10-21' });
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: 64 });
  assert.equal(l.warnings.some((w) => /Cargaste/.test(w)), false);   // 64 coincide con el cálculo automático: sin aviso de diferencia
  assert.equal(l.totals.remunerativo, 467_328);                  // 64 × 6.085 × 1,20
  // Ingreso el 21/10 → 11 días del mes: piso proporcional 293.519,96 / 30 × 11 = 107.623,99 < 467.328 → sin obra social adicional
  assert.equal(l.deducciones.find((d) => d.id === 'os_adic'), undefined);
  assert.equal(l.totals.descuentos, 111_478.66);
  assert.equal(l.totals.neto, 355_850);
  assert.ok(nuevaLinea(e, per, paramsDe(S), { hsNormales: 56 }).warnings.some((w) => /Cargaste 56 hs; el período tiene 64 hs/.test(w)));
});

test('obra social adicional: piso proporcional por días trabajados y solo si la remuneración es menor', () => {
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const e = emp({ id: 'h5', modalidad: 'hora', convenio: 'construccion', categoria: 'Ayudante', zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-10-21' });
  const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: 15 });    // 15 × 5.601 = 84.015 < 107.623,99
  assert.equal(l.deducciones.find((d) => d.id === 'os_adic').amount, Math.round((107_623.99 - 84_015) * 3) / 100);
  assert.equal(diasTrabajadosMes({ fechaIngreso: '2026-10-21', fechaEgreso: '' }, per), 11);
  assert.equal(diasTrabajadosMes({ fechaIngreso: '2026-01-01', fechaEgreso: '2026-10-10' }, per), 10);
  assert.equal(diasTrabajadosMes({ fechaIngreso: '2026-01-01', fechaEgreso: '' }, per), 30);   // mes de 31 días, tope 30
});
test('seguro de vida solo en la 2.ª quincena; redondeo deja el neto en pesos enteros siempre', () => {
  const e = emp({ id: 'h6', modalidad: 'hora', convenio: 'construccion', categoria: 'Oficial', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: false, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const q1 = nuevaLinea(e, describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 1 }), paramsDe(S), { hsNormales: 61 });
  const q2 = nuevaLinea(e, describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 }), paramsDe(S), { hsNormales: 61 });
  assert.equal(q1.deducciones.find((d) => d.id === 'seguro_vida'), undefined);
  assert.equal(q2.deducciones.find((d) => d.id === 'seguro_vida').amount, 20_349.7);
  assert.equal(q1.totals.neto % 1, 0); assert.equal(q2.totals.neto % 1, 0);
});
test('construcción: Fondo de Cese 12 % el 1.er año y 8 % desde el 2.º; UOCRA 2 % e IERIC 1 %; el resumen cuadra con el neto', () => {
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const base = { modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal' };
  const nuevo = nuevaLinea(emp({ id: 'a', ...base, fechaIngreso: '2026-03-01' }), per, paramsDe(S), { hsNormales: 56, adelanto: 50_000 });
  const viejo = nuevaLinea(emp({ id: 'b', ...base, fechaIngreso: '2024-03-01' }), per, paramsDe(S), { hsNormales: 56 });
  assert.equal(nuevo.patronales.fondoCese, 12); assert.equal(viejo.patronales.fondoCese, 8);
  assert.equal(nuevo.patronales.uocra, 2); assert.equal(nuevo.patronales.ieric, 1);
  assert.equal(emp({ id: 'm' }) && nuevaLinea(emp({ id: 'm' }), describirPeriodo({ tipo: 'mensual', year: 2026, month: 10 }), paramsDe(S)).patronales.fondoCese, 0);
  for (const l of [nuevo, viejo]) {
    const c = costoLaboral({ bruto: l.totals.bruto, baseAportes: l.totals.baseAportes, ausencias: l.totals.ausencias, deducciones: l.deducciones, patronales: l.patronales, neto: l.totals.neto });
    assert.equal(c.netoTrabajador, l.totals.neto);
    assert.equal(c.totalContribuciones, l.totals.patronal);
    assert.equal(c.cuadra, true);
    assert.equal(c.costoTotal, l.totals.costo);
    assert.ok(Math.abs(c.slices.reduce((a, x) => a + x.pct, 0) - 100) < 0.01);
  }
});

test('recibo clásico: C/Hs. del sueldo básico = horas hábiles de la quincena (lun-vie sin feriados, no días corridos)', async () => {
  const { datosClasico } = await import('../src/domain/payroll/clasico.js');
  const { horasPeriodo, snapshotEmpleado } = await import('../src/domain/payroll/engine.js');
  const run = armarRun({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 }, [emp({ periodicidad: 'quincenal' })], S);
  const l = run.lines[0];
  assert.equal(get(l, 'basico').hs, 72);                    // 2-6 y 10-13 de noviembre (el 9 es feriado): 9 días × 8 hs
  const fila = datosClasico(run, l).rows.find((r) => r.cod === 101);
  assert.equal(fila.concepto, 'SUELDO BASICO');
  assert.equal(fila.cant, '72.00');
  // 2.ª quincena (16-30/11, el 23 es feriado): 10 días hábiles × 8
  assert.equal(horasPeriodo(snapshotEmpleado(emp()), describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 2 })), 80);
  // ingreso a mitad de período: solo cuentan los días desde el ingreso
  assert.equal(horasPeriodo(snapshotEmpleado(emp({ fechaIngreso: '2026-11-11' })), describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 })), 24);
  // horario propio (viernes de 4 hs)
  assert.equal(horasPeriodo(snapshotEmpleado(emp({ horario: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 4 } })), describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 })), 64);
});

test('recibo clásico: BASICO del encabezado = valor hora según convenio/categoría', async () => {
  const { datosClasico, valorHoraRecibo } = await import('../src/domain/payroll/clasico.js');
  // Con escala de convenio (mensual): toma el valor hora de la escala del período (oct-2026: Oficial = 6.585)
  const a = armarRun({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 }, [emp({ periodicidad: 'quincenal', convenio: 'construccion', categoria: 'Oficial' })], S);
  assert.equal(valorHoraRecibo(a, a.lines[0]), 6585);
  assert.equal(datosClasico(a, a.lines[0]).basico, '6,585.00');
  // Vigencia noviembre 2026 (Oficial = 6.697)
  const b = armarRun({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 }, [emp({ periodicidad: 'quincenal', convenio: 'construccion', categoria: 'Oficial' })], S);
  assert.equal(valorHoraRecibo(b, b.lines[0]), 6697);
  // Sin escala: sueldo / divisor horario (1.000.000 / 200 = 5.000)
  const c = armarRun({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 }, [emp({ periodicidad: 'quincenal', convenio: 'otro', categoria: 'Jefe de Obra' })], S);
  assert.equal(valorHoraRecibo(c, c.lines[0]), 5000);
  // Por hora con valor manual: respeta el de la ficha
  const d = armarRun({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 }, [emp({ periodicidad: 'quincenal', modalidad: 'hora', convenio: 'construccion', categoria: 'Oficial', valorHora: 9000, valorHoraManual: true, sueldo: 0 })], S);
  assert.equal(valorHoraRecibo(d, d.lines[0]), 9000);
});


test('jornalero: las horas salen solas (8 días × 8 hs = 64) y el recibo coincide con el recibo real', async () => {
  const { datosClasico } = await import('../src/domain/payroll/clasico.js');
  const e = emp({ id: 'h9', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 20, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-10-21' });
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });
  const run = { ...per, lines: [], deposito: {} };
  // Sin cargar nada: toma las horas hábiles desde el ingreso (21/10 al 30/10 = 8 días)
  const auto = nuevaLinea(e, per, paramsDe(S));
  assert.equal(get(auto, 'basico').cant, 64);
  assert.equal(get(auto, 'basico').amount, 389_440);
  assert.ok(auto.warnings.some((w) => /Proporcional: 8 de 11 días hábiles del período = 64 hs/.test(w)));
  // Las ausencias injustificadas restan horas (1 día = 8 hs)
  assert.equal(get(nuevaLinea(e, per, paramsDe(S), { ausenciasInjustificadas: 1 }), 'basico').cant, 56);
  // Mismo caso del recibo de ejemplo (56 hs cargadas): mismos rótulos y montos de cada concepto
  const l = nuevaLinea(e, per, paramsDe(S), { hsNormales: 56 });
  const monto = (id) => l.deducciones.find((d) => d.id === id)?.amount;
  assert.deepEqual([monto('ap_jubilacion'), monto('ap_pami'), monto('ap_obraSocial'), monto('sindicato'), monto('seguro_vida')],
    [44_980.32, 12_267.36, 12_267.36, 10_222.8, 20_349.7]);
  const filas = datosClasico(run, l).rows.map((r) => `${r.cod} ${r.concepto}`);
  ['101 BASICO HS. NORMALES', '117 PRESENTISMO', '401 JUBILACION', '402 LEY 23568 INSSJP', '403 OBRA SOCIAL', '422 SDTO UOCRA AFILIADOS', '425 SEGURO DE VIDA CONST', '980 REDONDEO']
    .forEach((f) => assert.ok(filas.includes(f), `falta "${f}" en ${filas.join(' | ')}`));
  // Rótulo de la obra social adicional (cuando corresponde)
  const ay = nuevaLinea(emp({ id: 'h5', modalidad: 'hora', convenio: 'construccion', categoria: 'Ayudante', zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-10-21' }), per, paramsDe(S), { hsNormales: 15 });
  assert.ok(datosClasico(run, ay).rows.some((r) => r.cod === 405 && r.concepto === 'OB SOC ADIC JORNALIZ'));
});

test('quincenas de cualquier año: días y horas hábiles automáticos (hay quincenas de 9, 10 u 11 días)', async () => {
  const { jornadaPeriodo } = await import('../src/domain/payroll/jornada.js');
  const { feriadosCalculados, feriadosDelAnio, FERIADOS_2026, pascua } = await import('../src/domain/hr/feriados.js');
  const snap = { fechaIngreso: '2020-01-01', fechaEgreso: '' };
  const q = (y, m, n) => jornadaPeriodo(snap, describirPeriodo({ tipo: 'quincenal', year: y, month: m, quincena: n }));
  assert.deepEqual([q(2026, 10, 2).dias, q(2026, 10, 2).horas], [11, 88]);          // 2.ª quincena de octubre 2026
  assert.deepEqual([q(2027, 1, 1).dias, q(2027, 1, 2).dias, q(2027, 2, 1).dias], [10, 10, 9]);   // 1/1 feriado; Carnaval 8 y 9/2/2027
  // Ingreso a mitad de quincena: 8 de 11 días
  const j = jornadaPeriodo({ fechaIngreso: '2026-10-21', fechaEgreso: '' }, describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 }));
  assert.deepEqual([j.dias, j.diasPeriodo, j.horas], [8, 11, 64]);
  // El calendario calculado coincide con el calendario 2026 verificado (salvo los días extraordinarios / no laborables)
  const c26 = feriadosCalculados(2026);
  FERIADOS_2026.filter(([f, , t]) => t === 'feriado' && f !== '2026-11-09').forEach(([f]) => assert.ok(c26.has(f), `falta ${f}`));
  [...c26.keys()].forEach((f) => assert.ok(FERIADOS_2026.some(([x]) => x === f), `sobra ${f}`));
  // 2027: Pascua 28/3; Carnaval 8-9/2; Viernes Santo 26/3; trasladables (17/6 jue → lun 21/6; 17/8 mar → lun 16/8; 12/10 mar → lun 11/10; 20/11 sáb se queda)
  assert.equal(pascua(2027).toISOString().slice(0, 10), '2027-03-28');
  const f27 = feriadosDelAnio(2027);
  ['2027-02-08', '2027-02-09', '2027-03-26', '2027-06-21', '2027-08-16', '2027-10-11', '2027-11-20', '2027-12-25'].forEach((f) => assert.ok(f27.has(f), `2027: falta ${f}`));
  assert.equal(f27.has('2027-06-17'), false);
});

test('horas del período respetan las "Horas semanales" de la ficha (antes siempre eran 8 hs por día)', async () => {
  const { jornadaPeriodo } = await import('../src/domain/payroll/jornada.js');
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 });   // 11 días hábiles
  const base = { fechaIngreso: '2026-01-01' };
  assert.deepEqual(jornadaPeriodo(base, per), { dias: 11, horas: 88, diasPeriodo: 11, horasPeriodo: 88, feriadosDias: 0, feriadosHoras: 0 });                        // sin dato: 8 hs
  assert.equal(jornadaPeriodo({ ...base, horasSemanales: 30 }, per).horas, 66);                                                   // 6 hs × 11
  assert.equal(jornadaPeriodo({ ...base, horasSemanales: 44 }, per).horas, 96.8);                                                 // 8,8 hs × 11
  assert.equal(jornadaPeriodo({ ...base, horasSemanales: 30, horario: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 } }, per).horas, 88);        // el horario explícito manda
  const e = emp({ id: 'h6', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-01-01', horasSemanales: 30 });
  const l = nuevaLinea(e, per, paramsDe(S), {});
  assert.equal(l.rubros.find((r) => r.id === 'basico').cant, 66);                                                                 // automático: 66 hs, no 88
});

test('jornalero: el feriado no trabajado se paga como rubro aparte (quincena 2-13/11/2026, feriado lunes 9)', () => {
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 });
  const e = emp({ id: 'h7', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: true, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const l = nuevaLinea(e, per, paramsDe(S), {});
  const b = get(l, 'basico'), f = get(l, 'feriado_pago');
  assert.equal(b.cant, 72);                      // 9 días trabajables
  assert.equal(f.cant, 8);                       // 8 hs de feriado pagado
  assert.equal(f.amount, Math.round(f.base * 8 * 100) / 100);
  // Total = lo mismo que 80 hs corridas
  assert.ok(Math.abs(b.amount + f.amount - 80 * b.base) < 0.02);
  // Si además lo trabajó: se suma el día adicional y queda doble
  const l2 = nuevaLinea(e, per, paramsDe(S), { feriadosTrabajados: 1 });
  assert.ok(Math.abs(get(l2, 'feriado').amount - f.amount) < 0.02);
});

test('escalas y vigencias cargadas por el usuario: rigen desde su fecha, pisan a las de fábrica y crean convenios nuevos', async () => {
  const E = await import('../src/domain/convenios/escalas.js');
  const P = await import('../src/domain/legal/params.js');
  assert.equal(E.valorHoraEscala('construccion', 'Oficial', 'A', '2026-11-05'), 6697);
  E.aplicarTablas({
    convenios: {
      construccion: { vigencias: [{ desde: '2026-12-01', zonas: { A: { Oficial: 7000 } } }, { desde: '2026-11-01', zonas: { B: { Oficial: 7400 } } }] },
      uom: { nombre: 'UOM', presentismoPct: 20, categorias: ['Peón'], vigencias: [{ desde: '2026-11-01', zonas: { A: { Peón: 5000 } } }] },
    },
    sereno: [{ desde: '2026-11-01', valor: 1100000 }],
  });
  assert.equal(E.valorHoraEscala('construccion', 'Oficial', 'A', '2026-11-30'), 6697);   // antes de la nueva vigencia
  assert.equal(E.valorHoraEscala('construccion', 'Oficial', 'A', '2026-12-01'), 7000);   // desde su fecha
  assert.equal(E.valorHoraEscala('construccion', 'Oficial', 'B', '2026-11-05'), 7400);   // zona B de noviembre cargada a mano
  assert.equal(E.valorHoraEscala('uom', 'Peón', 'A', '2026-11-20'), 5000);               // convenio nuevo
  assert.equal(E.vigenciaEscala('construccion', 'Ayudante', 'A', '2026-11-20').desde, '2026-11-01');
  assert.equal(E.basicoSerenoZonaA('2026-11-10').valor, 1100000);
  P.aplicarBasesSipa([{ desde: '2026-12-01', valor: 151000, fuente: 'x' }]);
  assert.equal(P.baseMinimaSipa('2026-12-10').valor, 151000);
  assert.equal(P.baseMinimaSipa('2026-11-10').valor, 149592.45);
  // Volver a fábrica
  E.aplicarTablas({}); P.aplicarBasesSipa([]);
  assert.equal(E.valorHoraEscala('uom', 'Peón', 'A', '2026-11-20'), null);
  assert.equal(E.valorHoraEscala('construccion', 'Oficial', 'A', '2026-12-05'), 6697);
  assert.equal(P.baseMinimaSipa('2026-12-10').valor, 149592.45);
});

test('escala automática: categoría sin tildes/mayúsculas, convenio deducido si la ficha no lo tiene, y UOM de fábrica', async () => {
  const E = await import('../src/domain/convenios/escalas.js');
  E.aplicarTablas({});
  assert.equal(E.valorHoraEscala('construccion', ' medio  OFICIAL ', 'A', '2026-11-10'), 6188);
  assert.equal(E.valorHoraEscala('', 'Medio Oficial', 'A', '2026-11-10'), 6188);          // en dos convenios: se asume Construcción
  assert.equal(E.valorHoraEscala('', 'Operario Calificado', 'A', '2026-11-10'), 5054.03);   // solo existe en UOM
  assert.equal(E.vigenciaEscala('', 'Operario Calificado', 'A', '2026-11-10').convenio, 'uom');
  assert.equal(E.valorHoraEscala('uom', 'Oficial Múltiple Superior', 'A', '2026-11-10'), 7428.88);
  assert.equal(E.valorHoraEscala('comercio', 'Oficial', 'A', '2026-11-10'), null);          // convenio sin escala: no se adivina
  assert.equal(E.valorHoraEscala('', 'Categoría inexistente', 'A', '2026-11-10'), null);
});

test('jornalero de otro convenio: sin seguro de vida UOCRA ni contribuciones de la construcción', () => {
  const per = describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 2 });
  const mk = (id, convenio, categoria) => emp({ id, modalidad: 'hora', convenio, categoria, zona: 'A', sueldo: 0, presentismoPct: 0, adicionalAntiguedadPct: 0, afiliado: false, periodicidad: 'quincenal', fechaIngreso: '2026-01-01' });
  const c = nuevaLinea(mk('c1', 'construccion', 'Oficial'), per, paramsDe(S), {});
  const u = nuevaLinea(mk('u1', 'uom', 'Oficial'), per, paramsDe(S), {});
  assert.ok(c.deducciones.some((d) => d.id === 'seguro_vida'));
  assert.ok(!u.deducciones.some((d) => d.id === 'seguro_vida'));
  assert.equal(get(u, 'basico').base, 6445.08);                       // toma la escala de UOM
  assert.ok(u.warnings.some((w) => /distinto de Construcción/.test(w)));
  assert.equal(patronalesDe(mk('u2', 'uom', 'Oficial'), paramsDe(S), 2).fondoCese, 0);
});

test('valor hora por escala: toma la vigencia del período, no la de hoy', async () => {
  const { conValorHora } = await import('../src/domain/payroll/run.js');
  const { describirPeriodo } = await import('../src/domain/payroll/periodos.js');
  const emp = { modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', valorHora: 6188 };
  assert.equal(conValorHora(emp, describirPeriodo({ tipo: 'quincenal', year: 2026, month: 10, quincena: 2 })).valorHora, 6085);
  assert.equal(conValorHora(emp, describirPeriodo({ tipo: 'quincenal', year: 2026, month: 11, quincena: 1 })).valorHora, 6188);
});

test('nómina con vigencia elegida: usa esa escala aunque el período sea otro', async () => {
  const { armarRun } = await import('../src/domain/payroll/run.js');
  const emp = { id: 'e1', nombre: 'Test', modalidad: 'hora', convenio: 'construccion', categoria: 'Medio Oficial', zona: 'A', valorHora: 0, fechaIngreso: '2026-01-01', periodicidad: 'quincenal', regimen: 'dependencia', activo: true };
  const cfg = { tipo: 'quincenal', year: 2026, month: 11, quincena: 1, todos: true };
  const auto = armarRun(cfg, [emp], DEFAULT_SETTINGS);
  const fija = armarRun({ ...cfg, vigencia: '2026-10-01' }, [emp], DEFAULT_SETTINGS);
  assert.equal(auto.lines[0].snap.valorHora, 6188);
  assert.equal(fija.lines[0].snap.valorHora, 6085);
  assert.equal(fija.vigencia, '2026-10-01');
});
