import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmployeeRows, parseNumber, parseDate, TEMPLATE_HEADERS, TEMPLATE_EXAMPLE } from '../src/services/employee-import.js';

const row = (over = {}) => ({ ...Object.fromEntries(TEMPLATE_HEADERS.map((h, i) => [h, TEMPLATE_EXAMPLE[i]])), ...over });

test('parseNumber: formatos argentinos', () => {
  assert.equal(parseNumber('1.250.000,50'), 1250000.5);
  assert.equal(parseNumber('$ 1.250.000'), 1250000);
  assert.equal(parseNumber('1250000.75'), 1250000.75);
  assert.equal(parseNumber('8,33'), 8.33);
  assert.equal(parseNumber(500), 500);
  assert.ok(Number.isNaN(parseNumber('abc')));
});

test('parseDate: dd/mm/aaaa, ISO y serial de Excel', () => {
  assert.equal(parseDate('01/03/2022'), '2022-03-01');
  assert.equal(parseDate('1-3-22'), '2022-03-01');
  assert.equal(parseDate('2022-03-01'), '2022-03-01');
  assert.equal(parseDate(44621), '2022-03-01');
  assert.equal(parseDate(''), '');
  assert.equal(parseDate('ayer'), 'INVALID');
});

test('la fila de ejemplo de la plantilla es válida y mapea convenio/contrato', () => {
  const { rows, missingColumns } = parseEmployeeRows([row()]);
  assert.deepEqual(missingColumns, []);
  assert.equal(rows[0].status, 'nuevo', rows[0].errors.join('|'));
  assert.equal(rows[0].data.convenio, 'comercio');
  assert.equal(rows[0].data.cuil, '20301234567');
  assert.equal(rows[0].data.presentismoPct, 8.33);
});

test('detecta errores, duplicados y actualizaciones por DNI', () => {
  const existing = [{ id: 'e1', dni: '111111111', nombre: 'X' }];
  const { rows } = parseEmployeeRows([
    row({ 'Apellido y nombre *': '' }),
    row({ DNI: '111111111' }),
    row({ DNI: '222222222' }), row({ DNI: '222222222' }),
    row({ 'Remuneración mensual bruta *': 'mucho' }),
    row({ CBU: '123' }),
  ], existing);
  assert.equal(rows[0].status, 'error');
  assert.equal(rows[1].status, 'actualizar'); assert.equal(rows[1].id, 'e1');
  assert.equal(rows[2].status, 'nuevo'); assert.equal(rows[3].status, 'error');
  assert.equal(rows[4].status, 'error');
  assert.equal(rows[5].status, 'error');
});

test('columnas obligatorias faltantes', () => {
  const { missingColumns } = parseEmployeeRows([{ Foo: 1 }]);
  assert.deepEqual(missingColumns, ['nombre', 'fechaIngreso', 'sueldo']);
});

test('ignora filas vacías', () => {
  const blank = Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, '']));
  assert.equal(parseEmployeeRows([row(), blank]).rows.length, 1);
});
