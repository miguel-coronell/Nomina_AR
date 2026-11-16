/** Armado y recálculo de una corrida de nómina (todas las líneas de un período). */
import { round2 } from '../../core/format.js';
import { describirPeriodo, elegible, incluirEn } from './periodos.js';
import { vigenciaEscala } from '../convenios/escalas.js';
import { calcularLinea, snapshotEmpleado, normalizarNovedades, NOVEDADES_VACIAS } from './engine.js';

export const paramsDe = (settings) => ({
  aportes: { ...settings.aportes }, patronales: { ...settings.patronales }, topeRemunerativo: Number(settings.topeRemunerativo) || 0,
  divisorFeriado: Number(settings.divisorFeriado) || 25,
  jornal: { ...(settings.jornal || {}) },
  feriados: { custom: [...(settings.feriados?.custom || [])], removidos: [...(settings.feriados?.removidos || [])] },
});

/** Para personal por hora con valor automático: toma la escala del convenio vigente en el período. */
export const conValorHora = (emp, periodo) => {
  if (emp.modalidad !== 'hora' || emp.valorHoraManual) return emp;
  const v = vigenciaEscala(emp.convenio, emp.categoria, emp.zona || 'A', periodo.vigencia || periodo.desde);   // vigencia elegida en la nómina; si no, la del inicio del período
  return v ? { ...emp, valorHora: v.valor, convenio: emp.convenio || v.convenio } : emp;   // ficha sin convenio: se deduce de la categoría
};

export function nuevaLinea(emp0, periodo, params, novedades = NOVEDADES_VACIAS) {
  const emp = conValorHora(emp0, periodo);
  const snap = snapshotEmpleado(emp);
  const calc = calcularLinea(snap, novedades, periodo, params);
  return {
    employeeId: emp.id, nombre: emp.nombre, dni: emp.dni || '', cuil: emp.cuil || '', legajo: emp.legajo || '', obraSocial: emp.obraSocial || '',
    categoria: emp.categoria || '', convenio: emp.convenio || '', regimen: emp.regimen === 'pasantia' ? 'pasantia' : 'dependencia', institucion: emp.institucion || '', carrera: emp.carrera || '', banco: emp.banco || '', cbu: emp.cbu || '',
    snap, novedades: normalizarNovedades(novedades), ...calc,
    pago: { estado: 'pendiente', fecha: '', medio: '' },
  };
}

export function recalcLinea(line, periodo, params) {
  const calc = calcularLinea(line.snap, line.novedades, periodo, params);
  return { ...line, ...calc };
}

export function totalesRun(lines) {
  const sum = (f) => round2(lines.reduce((a, l) => a + f(l), 0));
  return {
    empleados: lines.length, bruto: sum((l) => l.totals.bruto), remunerativo: sum((l) => l.totals.remunerativo),
    noRemunerativo: sum((l) => l.totals.noRemunerativo), descuentos: sum((l) => l.totals.descuentos), neto: sum((l) => l.totals.neto),
    patronal: sum((l) => l.totals.patronal), costo: sum((l) => l.totals.costo),
    pagado: sum((l) => (l.pago.estado === 'pagado' ? l.totals.neto : 0)),
    pendiente: sum((l) => (l.pago.estado === 'pagado' ? 0 : l.totals.neto)),
    pagados: lines.filter((l) => l.pago.estado === 'pagado').length,
  };
}

/** Crea una corrida nueva (borrador) con los empleados que corresponden al período. */
export function armarRun(cfg, employees, settings) {
  const periodo = { ...describirPeriodo(cfg), vigencia: /^\d{4}-\d{2}-\d{2}$/.test(cfg.vigencia || '') ? cfg.vigencia : '' };
  const params = paramsDe(settings);
  const lines = employees.filter((e) => (cfg.todos || incluirEn(e, periodo.tipo)) && elegible(e, periodo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((e) => nuevaLinea(e, periodo, params));
  return {
    ...periodo, fechaPago: cfg.fechaPago || '', notas: cfg.notas || '', estado: 'borrador', params,
    lines, totals: totalesRun(lines),
  };
}

export const periodoDeRun = (run) => ({ tipo: run.tipo, desde: run.desde, hasta: run.hasta, semestre: run.semestre, quincena: run.quincena, vigencia: run.vigencia || '' });

export function recalcRun(run, settings) {
  const params = run.estado === 'borrador' && settings ? paramsDe(settings) : run.params;
  const periodo = periodoDeRun(run);
  const lines = run.lines.map((l) => recalcLinea(l, periodo, params));
  return { ...run, params, lines, totals: totalesRun(lines) };
}

/** Estado derivado de los pagos: 'pagada' si todas las líneas están pagadas. */
export const estadoTrasPagos = (run) =>
  run.estado === 'borrador' ? 'borrador' : run.lines.length && run.lines.every((l) => l.pago.estado === 'pagado') ? 'pagada' : 'liquidada';
