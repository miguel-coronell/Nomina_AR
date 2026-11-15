/**
 * Aplica el registro de asistencia (marcaciones de entrada/salida) a las líneas de una nómina.
 * La asistencia es la fuente de verdad de: horas extra, feriados trabajados, faltas y licencias.
 * Las demás novedades (bonos, adelantos, observaciones) no se tocan.
 */
import { resumenPeriodo, novedadesDesdeResumen } from '../hr/asistencia.js';
import { feriadosEntre } from '../hr/feriados.js';
import { normalizarNovedades } from './engine.js';
import { periodoDeRun, recalcLinea } from './run.js';

const CAMPOS = ['diasTrab', 'hsPactadas', 'hsTrab', 'hsNormales', 'he50', 'he100', 'bancoGen', 'bancoUsado', 'feriadosTrab', 'faltasInj', 'faltasJust', 'licencias', 'vacaciones', 'sinGoce', 'hsFaltantes', 'abiertos', 'sinRegistrar'];
export const DERIVADAS = ['he50', 'he100', 'ausenciasInjustificadas', 'sinGoce', 'feriadosTrabajados', 'hsDescontar'];

export function aplicarAsistencia(run, asistencia = {}, ajustesFeriados, { descontarHoras = false } = {}) {
  if (run.tipo === 'sac') return { lines: run.lines, conDatos: 0, avisos: [] };
  const feriados = feriadosEntre(run.desde, run.hasta, ajustesFeriados);
  const periodo = periodoDeRun(run);
  const avisos = [];
  let conDatos = 0;
  const lines = run.lines.map((l) => {
    const days = asistencia[l.employeeId];
    const hay = days && Object.keys(days).length > 0;
    if (!hay) {
      if (!l.asistencia) return l;
      const nov = { ...l.novedades }; DERIVADAS.forEach((k) => { nov[k] = 0; });
      const { asistencia: _quitar, ...resto } = l;
      return recalcLinea({ ...resto, novedades: normalizarNovedades(nov) }, periodo, run.params);
    }
    conDatos += 1;
    const res = resumenPeriodo({ ...l.snap }, run.desde, run.hasta, days, feriados);
    res.avisos.forEach((a) => avisos.push(`${l.nombre}: ${a}`));
    const nov = normalizarNovedades({ ...l.novedades, ...novedadesDesdeResumen(res, { descontarHoras }) });
    const resumen = Object.fromEntries(CAMPOS.map((k) => [k, res[k]]));
    return recalcLinea({ ...l, novedades: nov, asistencia: resumen }, periodo, run.params);
  });
  return { lines, conDatos, avisos };
}
