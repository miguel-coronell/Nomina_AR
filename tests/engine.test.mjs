import test from 'node:test';
import assert from 'node:assert/strict';
import { liquidar, ValidationError } from '../src/domain/liquidation/index.js';
import { calcAntiguedad } from '../src/domain/liquidation/rules/antiguedad.js';
import { montoEnLetras } from '../src/core/number-words.js';

const base = { motivo: 'despido_sin_causa', fechaIngreso: '2020-01-15', fechaEgreso: '2026-06-10', sueldo: 1_000_000 };
const rubro = (r, id) => r.rubros.find((x) => x.id === id);

test('antigüedad: fracción > 3 meses suma un período', () => {
  assert.equal(calcAntiguedad('2020-01-01', '2025-03-31').periodos, 5);  // 5a 3m 0d → no suma
  assert.equal(calcAntiguedad('2020-01-01', '2025-04-01').periodos, 6);  // 5a 3m 1d → suma
  assert.equal(calcAntiguedad('2020-01-01', '2025-12-31').years, 6);
  assert.equal(calcAntiguedad('2020-01-15', '2026-06-10').texto, '6 años, 4 meses y 27 días');
});

test('despido sin causa (régimen Ley 27.802)', () => {
  const r = liquidar(base);
  assert.equal(r.marco.ley27802, true);
  assert.equal(rubro(r, 'indem_245').amount, 7_000_000);            // 7 períodos
  assert.equal(rubro(r, 'preaviso').amount, 2_000_000);             // > 5 años
  assert.equal(rubro(r, 'sac_preaviso').amount, 166_666.67);
  assert.equal(rubro(r, 'integracion').amount, 666_666.67);         // 20 días
  assert.equal(rubro(r, 'dias_trabajados').amount, 333_333.33);     // 10/30
  assert.ok(r.totals.neto > 0 && r.totals.neto < r.totals.bruto);
});

test('preaviso otorgado: no hay preaviso ni integración', () => {
  const r = liquidar({ ...base, preavisoOtorgado: true });
  assert.equal(rubro(r, 'preaviso'), undefined);
  assert.equal(rubro(r, 'integracion'), undefined);
});

test('Vizzoti: el tope no baja de 67% del sueldo', () => {
  const r = liquidar({ ...base, topeConvenio: 500_000 });
  assert.equal(rubro(r, 'indem_245').amount, 670_000 * 7);
  const r2 = liquidar({ ...base, topeConvenio: 900_000 });
  assert.equal(rubro(r2, 'indem_245').amount, 900_000 * 7);
});

test('renuncia: sin indemnización ni preaviso', () => {
  const r = liquidar({ ...base, motivo: 'renuncia' });
  assert.equal(rubro(r, 'indem_245'), undefined);
  assert.equal(rubro(r, 'preaviso'), undefined);
  assert.ok(rubro(r, 'sac_prop'));
});

test('período de prueba (post Ley 27.802): sin indemnización ni preaviso', () => {
  const r = liquidar({ ...base, fechaIngreso: '2026-05-01', fechaEgreso: '2026-08-15' });
  assert.equal(rubro(r, 'indem_245'), undefined);
  assert.equal(rubro(r, 'preaviso'), undefined);
  assert.ok(r.warnings.some((w) => /período de prueba/.test(w)));
});

test('mínimo de un mes cuando la antigüedad no completa un período', () => {
  // período de prueba manual de 1 mes para poder llegar a esta situación
  const r = liquidar({ ...base, fechaIngreso: '2026-01-01', fechaEgreso: '2026-02-20', sueldo: 500_000 }, { periodoPruebaMeses: 1 });
  assert.equal(r.antiguedad.periodos, 0);
  assert.equal(rubro(r, 'indem_245').amount, 500_000);
});

test('SAC proporcional: 1.er semestre', () => {
  const r = liquidar({ ...base, motivo: 'renuncia', fechaEgreso: '2026-03-31' });
  assert.equal(rubro(r, 'sac_prop').amount, Math.round((500_000 * 90 / 181) * 100) / 100);
});

test('SAC: ingreso dentro del semestre usa desde el ingreso', () => {
  const r = liquidar({ ...base, motivo: 'renuncia', fechaIngreso: '2026-04-01', fechaEgreso: '2026-06-30' });
  assert.equal(rubro(r, 'sac_prop').amount, Math.round((500_000 * 91 / 181) * 100) / 100);
});

test('multas derogadas: se ignoran después de Ley Bases y se avisa', () => {
  const r = liquidar({ ...base, multaArt80: true, multaArt1: true, multaArt2: true });
  assert.equal(r.totals.multas, 0);
  assert.ok(r.warnings.some((w) => /derogadas/.test(w)));
});

test('multas históricas: casos anteriores a Ley Bases', () => {
  const r = liquidar({ ...base, fechaIngreso: '2015-01-01', fechaEgreso: '2023-06-30', multaArt80: true, multaArt1: true, multaArt2: true });
  assert.equal(rubro(r, 'multa_80').amount, 3_000_000);
  assert.equal(rubro(r, 'multa_25323_1').amount, rubro(r, 'indem_245').amount);
  assert.ok(rubro(r, 'multa_25323_2').amount > 0);
  assert.equal(r.marco.periodoPruebaMeses, 3);
});

test('aportes solo sobre remunerativos', () => {
  const r = liquidar(base);
  const jub = r.deducciones.find((d) => d.id === 'jubilacion');
  assert.equal(jub.base, r.totals.remunerativo);
  assert.equal(jub.amount, Math.round(r.totals.remunerativo * 0.11 * 100) / 100);
});

test('vacaciones: descuenta días gozados', () => {
  const sin = liquidar({ ...base, motivo: 'renuncia' });
  const con = liquidar({ ...base, motivo: 'renuncia', diasVacacionesGozadas: 1000 });
  assert.ok(rubro(sin, 'vacaciones').amount > 0);
  assert.equal(rubro(con, 'vacaciones'), undefined);
});

test('validación', () => {
  assert.throws(() => liquidar({ ...base, sueldo: 0 }), ValidationError);
  assert.throws(() => liquidar({ ...base, fechaEgreso: '2019-01-01' }), (e) => !!e.errors.fechaEgreso);
});

test('monto en letras', () => {
  assert.equal(montoEnLetras(1234.5), 'Son pesos mil doscientos treinta y cuatro con 50/100.');
  assert.equal(montoEnLetras(21_000_000), 'Son pesos veintiún millones con 00/100.');
  assert.equal(montoEnLetras(1_000_000), 'Son pesos un millón con 00/100.');
  assert.equal(montoEnLetras(100), 'Son pesos cien con 00/100.');
});

import { addBusinessDays } from '../src/core/dates.js';
test('días hábiles: 4 días hábiles desde un jueves saltea el fin de semana', () => {
  assert.equal(addBusinessDays('2026-10-22', 4), '2026-10-28'); // jue → mar
  assert.equal(addBusinessDays('2026-10-23', 1), '2026-10-26'); // vie → lun
});
test('liquidación: el resultado guarda parámetros patronales', () => {
  const r = liquidar(base);
  assert.ok(r.params.patronales.sipa > 0);
});
