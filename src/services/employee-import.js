/**
 * Importación de empleados desde Excel/CSV: plantilla, mapeo de columnas,
 * normalización de valores y validación fila por fila. Sin DOM (testeable).
 */
import { pctFicha } from '../core/pct.js';
import { ESCALAS, listaConvenios } from '../domain/convenios/escalas.js';
import { CONVENIOS } from '../domain/legal/articles.js';
import { CONTRATOS, JORNADAS, PERIODICIDADES, normalizeEmployee, validateEmployee } from './employees.service.js';

export const TEMPLATE_HEADERS = [
  'Apellido y nombre *', 'DNI', 'CUIL', 'Legajo', 'Fecha de ingreso * (dd/mm/aaaa)', 'Fecha de egreso (dd/mm/aaaa)',
  'Remuneración mensual bruta *', 'Tipo de contrato', 'Convenio', 'Categoría', 'Jornada', 'Periodicidad de pago',
  'Antigüedad % por año', 'Presentismo %', 'Obra social', 'ART', 'Banco', 'CBU', 'Notas',
  'Régimen', 'Horas por día (lun a vie)', 'Fecha de finalización', 'Institución educativa', 'Carrera',
];

export const TEMPLATE_EXAMPLE = [
  'Pérez, Juan', '30123456', '20-30123456-7', '001', '01/03/2022', '', 1250000, 'Tiempo indeterminado',
  'CCT 130/75 — Empleados de Comercio', 'Administrativo B', 'Completa', 'Mensual', 1, 8.33, 'OSECAC', 'Galeno ART', 'Banco Nación', '0110012340001234567890', '',
  'Relación de dependencia', 8, '', '', '',
];

export const TEMPLATE_HELP = [
  ['INSTRUCCIONES'],
  ['1. Completá la hoja "Empleados" a partir de la fila 2 (la fila de ejemplo se puede borrar).'],
  ['2. Obligatorios: Apellido y nombre, Fecha de ingreso, Remuneración mensual bruta.'],
  ['3. Fechas: dd/mm/aaaa (también se aceptan fechas de Excel o aaaa-mm-dd).'],
  ['4. Remuneración: número sin símbolos. Se aceptan 1250000 o 1.250.000,50.'],
  ['5. CUIL: 11 dígitos. CBU: 22 dígitos (con o sin guiones/espacios).'],
  ['6. Si el DNI ya existe en tu cuenta se puede actualizar la ficha (opción en la pantalla de importación).'],
  [''],
  ['VALORES ADMITIDOS'],
  ['Tipo de contrato', CONTRATOS.map((c) => c[1]).join(' | ')],
  ['Jornada', JORNADAS.map((c) => c[1]).join(' | ')],
  ['Periodicidad de pago', PERIODICIDADES.map((c) => c[1]).join(' | ')],
  ['Convenio', listaConvenios().map((c) => c.nombre).join(' | ')],
  ['Antigüedad % por año', 'Porcentaje que se adiciona al básico por cada año de antigüedad (ej: 1 en Comercio)'],
  ['Presentismo %', 'Porcentaje de presentismo sobre básico + antigüedad (ej: 8,33). Se pierde ante ausencias injustificadas.'],
  ['Régimen', 'Relación de dependencia | Pasantía. En pasantías la "Remuneración" es la asignación estímulo mensual (máx. 20 hs semanales).'],
  ['Horas por día (lun a vie)', 'Jornada diaria de lunes a viernes (ej: 8, o 4 para media jornada). Después podés ajustar cada día en la ficha.'],
  ['Fecha de finalización', 'Fin previsto de pasantía o contrato a plazo (dd/mm/aaaa).'],
];

/* ---------- normalización ---------- */
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\(.*?\)/g, '').replace(/[*]/g, '').replace(/\s+/g, ' ').trim();

const ALIASES = {
  nombre: ['apellido y nombre', 'nombre y apellido', 'nombre', 'empleado', 'apellido, nombre'],
  dni: ['dni', 'documento'],
  cuil: ['cuil', 'cuit/cuil'],
  legajo: ['legajo', 'nro legajo', 'n legajo'],
  fechaIngreso: ['fecha de ingreso', 'fecha ingreso', 'ingreso'],
  fechaEgreso: ['fecha de egreso', 'fecha egreso', 'egreso', 'baja'],
  sueldo: ['remuneracion mensual bruta', 'remuneracion', 'sueldo', 'sueldo bruto', 'salario', 'basico', 'sueldo basico'],
  tipoContrato: ['tipo de contrato', 'contrato', 'modalidad'],
  convenio: ['convenio', 'convenio colectivo', 'cct'],
  categoria: ['categoria'],
  jornada: ['jornada'],
  periodicidad: ['periodicidad de pago', 'periodicidad', 'frecuencia de pago'],
  adicionalAntiguedadPct: ['antiguedad % por ano', 'antiguedad %', 'adicional antiguedad', '% antiguedad'],
  presentismoPct: ['presentismo %', 'presentismo', '% presentismo'],
  obraSocial: ['obra social'],
  art: ['art', 'aseguradora'],
  banco: ['banco'],
  cbu: ['cbu', 'cbu/cvu'],
  notas: ['notas', 'observaciones'],
  regimen: ['regimen', 'regimen laboral'],
  horasDia: ['horas por dia', 'horas diarias', 'jornada diaria'],
  fechaFin: ['fecha de finalizacion', 'fecha de fin', 'fin de pasantia', 'finalizacion'],
  institucion: ['institucion educativa', 'institucion', 'universidad'],
  carrera: ['carrera'],
  sector: ['sector', 'area', 'departamento'],
};

export function mapHeaders(headers) {
  const map = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [field, names] of Object.entries(ALIASES)) if (names.includes(n) && !(field in map)) map[field] = h;
  }
  return map;
}

export function parseNumber(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[$\s]/g, '');
  if (!s) return 0;
  const comma = s.includes(','), dot = s.includes('.');
  if (comma && dot) s = s.replace(/\./g, '').replace(',', '.');
  else if (comma) s = s.replace(',', '.');
  else if (dot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

const p2 = (n) => String(n).padStart(2, '0');
export function parseDate(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date && !Number.isNaN(+v)) return `${v.getUTCFullYear()}-${p2(v.getUTCMonth() + 1)}-${p2(v.getUTCDate())}`;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return Number.isNaN(+d) ? 'INVALID' : `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${p2(m[2])}-${p2(m[1])}`; }
  return 'INVALID';
}

const pick = (list, v, fallback) => {
  const n = norm(v);
  if (!n) return fallback;
  const hit = list.find(([id, label]) => norm(id) === n || norm(label) === n);
  return hit ? hit[0] : null;
};

function parseConvenio(v) {
  const n = norm(v);
  if (!n) return '';
  const lista = listaConvenios();
  const hit = lista.find((c) => c.id === n || norm(c.nombre) === n || norm(c.nombre).includes(n) || n.includes(norm(c.nombre).split(' — ')[0]));
  return hit ? hit.id : null;
}

/**
 * Convierte filas crudas de la hoja en candidatos listos para importar.
 * `existing`: empleados ya guardados (para detectar actualizaciones por DNI).
 * Devuelve { rows, missingColumns } con rows[i] = { n, data, errors[], warnings[], status, id? }
 */
export function parseEmployeeRows(rawRows, existing = [], { updateExisting = true } = {}) {
  const headers = rawRows.length ? Object.keys(rawRows[0]) : [];
  const map = mapHeaders(headers);
  const missingColumns = ['nombre', 'fechaIngreso', 'sueldo'].filter((f) => !map[f]);
  if (missingColumns.length) return { rows: [], missingColumns };

  const byDni = new Map(existing.filter((e) => e.dni).map((e) => [e.dni, e]));
  const seen = new Set();
  const rows = [];

  rawRows.forEach((raw, i) => {
    const get = (f) => (map[f] ? raw[map[f]] : '');
    if (Object.values(raw).every((v) => String(v).trim() === '')) return; // fila vacía
    const errors = [], warnings = [];

    const tipo = pick(CONTRATOS, get('tipoContrato'), 'indeterminado');
    const jornada = pick(JORNADAS, get('jornada'), 'completa');
    const period = pick(PERIODICIDADES, get('periodicidad'), 'mensual');
    const convenio = parseConvenio(get('convenio'));
    if (tipo === null) warnings.push(`Tipo de contrato "${get('tipoContrato')}" no reconocido: se usó "Tiempo indeterminado".`);
    if (jornada === null) warnings.push(`Jornada "${get('jornada')}" no reconocida: se usó "Completa".`);
    if (period === null) warnings.push(`Periodicidad "${get('periodicidad')}" no reconocida: se usó "Mensual".`);
    if (convenio === null) warnings.push(`Convenio "${get('convenio')}" no reconocido: quedó vacío.`);

    const fi = parseDate(get('fechaIngreso')), fe = parseDate(get('fechaEgreso'));
    const sueldo = parseNumber(get('sueldo'));
    const ff = parseDate(get('fechaFin'));
    const horasDia = parseNumber(get('horasDia')) || 0;
    if (ff === 'INVALID') errors.push('Fecha de finalización inválida.');
    if (fi === 'INVALID') errors.push('Fecha de ingreso inválida.');
    if (fe === 'INVALID') errors.push('Fecha de egreso inválida.');
    if (Number.isNaN(sueldo)) errors.push('Remuneración no es un número.');

    const data = normalizeEmployee({
      nombre: get('nombre'), dni: get('dni'), cuil: get('cuil'), legajo: get('legajo'),
      fechaIngreso: fi === 'INVALID' ? '' : fi, fechaEgreso: fe === 'INVALID' ? '' : fe,
      sueldo: Number.isNaN(sueldo) ? 0 : sueldo,
      tipoContrato: tipo || 'indeterminado', jornada: jornada || 'completa', periodicidad: period || 'mensual',
      convenio: convenio || '', categoria: get('categoria'),
      adicionalAntiguedadPct: pctFicha(parseNumber(get('adicionalAntiguedadPct')) || 0),
      presentismoPct: pctFicha(parseNumber(get('presentismoPct')) || 0),   // «20%» en Excel llega como 0,2
      obraSocial: get('obraSocial'), art: get('art'), banco: get('banco'), cbu: get('cbu'), notas: get('notas'),
      regimen: norm(get('regimen')).startsWith('pas') ? 'pasantia' : 'dependencia',
      horasSemanales: horasDia > 0 ? horasDia * 5 : 0, sector: get('sector'),
      fechaFin: ff === 'INVALID' ? '' : ff, institucion: get('institucion'), carrera: get('carrera'),
    });

    const v = validateEmployee(data);
    errors.push(...Object.values(v));

    let status = 'nuevo', id;
    if (data.dni) {
      if (seen.has(data.dni)) errors.push('DNI repetido dentro del archivo.');
      seen.add(data.dni);
      const found = byDni.get(data.dni);
      if (found) {
        if (updateExisting) { status = 'actualizar'; id = found.id; }
        else errors.push('Ya existe un empleado con ese DNI.');
      }
    } else warnings.push('Sin DNI: no se puede detectar duplicados.');
    if (errors.length) status = 'error';
    rows.push({ n: i + 2, data, errors, warnings, status, id });
  });
  return { rows, missingColumns: [] };
}

/** Filas para exportar empleados con las mismas columnas de la plantilla. */
export function employeesToRows(list) {
  const lbl = (arr, v) => arr.find((x) => x[0] === v)?.[1] || v;
  const [d, m, a] = [(s) => s.slice(8, 10), (s) => s.slice(5, 7), (s) => s.slice(0, 4)];
  const f = (s) => (s ? `${d(s)}/${m(s)}/${a(s)}` : '');
  return list.map((e) => [
    e.nombre, e.dni, e.cuil, e.legajo, f(e.fechaIngreso), f(e.fechaEgreso), e.sueldo, lbl(CONTRATOS, e.tipoContrato),
    CONVENIOS.find((c) => c.id === e.convenio)?.nombre || e.convenio || '', e.categoria, lbl(JORNADAS, e.jornada),
    lbl(PERIODICIDADES, e.periodicidad || 'mensual'), e.adicionalAntiguedadPct || 0, e.presentismoPct || 0, e.obraSocial, e.art, e.banco, e.cbu, e.notas,
    e.regimen === 'pasantia' ? 'Pasantía' : 'Relación de dependencia', e.horasSemanales ? Math.round((e.horasSemanales / 5) * 100) / 100 : '', f(e.fechaFin), e.institucion || '', e.carrera || '',
  ]);
}
