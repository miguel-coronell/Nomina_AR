import test from 'node:test';
import assert from 'node:assert/strict';
import { matcher } from '../src/core/search.js';
import { createPager } from '../src/core/ui/pager.js';

test('buscador: ignora tildes/mayúsculas y busca en varios campos', () => {
  const m = matcher('PEREZ 3012');
  assert.ok(m('Pérez, Juan', '30123456', '001'));
  assert.ok(!m('Gómez, Ana', '28111222', '002'));
  assert.ok(matcher('')('cualquier cosa'));
  assert.ok(matcher('20-30123456-7')('x', '20301234567'));   // CUIL con guiones
  assert.ok(matcher('001')('Juan', '30123456', '001'));        // legajo
});

test('paginador: 10 por página, límites y ventana de números', () => {
  const p = createPager();
  const items = Array.from({ length: 34 }, (_, i) => i);
  let info = p.apply(items);
  assert.equal(info.rows.length, 10); assert.equal(info.pages, 4); assert.equal(info.from, 1); assert.equal(info.to, 10);
  p.attach({ addEventListener() {} });
  info = p.apply(items); assert.equal(info.page, 1);
  const last = createPager(); last.apply(items); // página fuera de rango se ajusta al borrar elementos
  assert.equal(last.apply(items.slice(0, 5)).page, 1);
  assert.equal(p.apply([]).rows.length, 0);
  assert.equal(p.view(p.apply([])).toString(), '');
  assert.match(p.view(p.apply(items)).toString(), /Mostrando <b>1–10<\/b> de <b>34<\/b>/);
});
