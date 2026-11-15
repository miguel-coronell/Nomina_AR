/**
 * MOTOR DE LIQUIDACIÓN FINAL
 * ---------------------------------------------------------------
 * Función pura: liquidar(input, settings) → resultado. Sin DOM, sin red.
 * Cada concepto vive en rules/*.js: para agregar uno nuevo, escribí la
 * regla y sumala a la lista de `reglas` más abajo.
 */
import { isValidISO, toUTC, parseISO } from '../../core/dates.js';
import { round2 } from '../../core/format.js';
import { MOTIVOS, resolverMarcoLegal } from '../legal/params.js';
import { DEFAULT_SETTINGS } from '../../services/settings.service.js';
import { calcAntiguedad } from './rules/antiguedad.js';
import { diasTrabajadosMes, horasExtras, sacProporcional, vacacionesNoGozadas } from './rules/haberes.js';
import { indemnizacionAntiguedad, preaviso, integracionMes, gratificacionAcuerdo } from './rules/despido.js';
import { multas } from './rules/multas.js';
import { deducciones } from './rules/deducciones.js';

const n = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };

export function normalizarInput(raw = {}) {
  return {
    nombre: String(raw.nombre || '').trim(),
    motivo: raw.motivo || 'despido_sin_causa',
    fechaIngreso: raw.fechaIngreso || '',
    fechaEgreso: raw.fechaEgreso || '',
    sueldo: n(raw.sueldo),
    topeConvenio: n(raw.topeConvenio),
    preavisoOtorgado: !!raw.preavisoOtorgado,
    diasVacacionesGozadas: Math.max(0, n(raw.diasVacacionesGozadas)),
    he50: Math.max(0, n(raw.he50)),
    he100: Math.max(0, n(raw.he100)),
    acuerdoMonto: Math.max(0, n(raw.acuerdoMonto)),
    multaArt80: !!raw.multaArt80,
    multaArt1: !!raw.multaArt1,
    multaArt2: !!raw.multaArt2,
  };
}

export function validarInput(inp) {
  const errors = {};
  if (!MOTIVOS.some((m) => m.id === inp.motivo)) errors.motivo = 'Seleccioná un motivo de egreso.';
  if (!isValidISO(inp.fechaIngreso)) errors.fechaIngreso = 'Ingresá la fecha de ingreso.';
  if (!isValidISO(inp.fechaEgreso)) errors.fechaEgreso = 'Ingresá la fecha de egreso.';
  if (!errors.fechaIngreso && !errors.fechaEgreso && toUTC(parseISO(inp.fechaEgreso)) < toUTC(parseISO(inp.fechaIngreso)))
    errors.fechaEgreso = 'El egreso no puede ser anterior al ingreso.';
  if (!(inp.sueldo > 0)) errors.sueldo = 'Ingresá una remuneración mayor a cero.';
  return errors;
}

export class ValidationError extends Error {
  constructor(errors) { super('VALIDATION'); this.errors = errors; }
}

export function liquidar(rawInput, settings = DEFAULT_SETTINGS) {
  const inp = normalizarInput(rawInput);
  const errors = validarInput(inp);
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const cfg = { ...DEFAULT_SETTINGS, ...settings, aportes: { ...DEFAULT_SETTINGS.aportes, ...(settings.aportes || {}) } };
  const ctx = {
    inp, settings: cfg,
    antig: calcAntiguedad(inp.fechaIngreso, inp.fechaEgreso),
    legal: resolverMarcoLegal(inp.fechaEgreso, cfg),
    warnings: [],
    refs: new Set(),
  };

  const reglas = [diasTrabajadosMes, horasExtras, sacProporcional, vacacionesNoGozadas,
    indemnizacionAntiguedad, preaviso, integracionMes, gratificacionAcuerdo];
  const rubros = reglas.flatMap((r) => r(ctx));
  rubros.push(...multas(ctx, rubros));

  rubros.forEach((r) => ctx.refs.add(r.ref));
  if (ctx.legal.ley27802 && rubros.some((r) => r.id === 'indem_245')) ctx.refs.add('Ley 27.802 (nuevo Art. 245)');

  const suma = (fn) => round2(rubros.filter(fn).reduce((a, r) => a + r.amount, 0));
  const remunerativo = suma((r) => r.tipo === 'remunerativo');
  const deduc = deducciones(remunerativo, cfg);
  const totalDeduc = round2(deduc.reduce((a, d) => a + d.amount, 0));
  const bruto = suma(() => true);

  return {
    input: inp,
    antiguedad: ctx.antig,
    marco: ctx.legal,
    rubros,
    deducciones: deduc,
    totals: {
      bruto,
      remunerativo,
      indemnizatorio: suma((r) => r.tipo === 'indemnizatorio'),
      multas: suma((r) => r.tipo === 'multa'),
      deducciones: totalDeduc,
      neto: round2(bruto - totalDeduc),
    },
    refs: [...ctx.refs],
    warnings: ctx.warnings,
    params: { patronales: { ...cfg.patronales }, topeRemunerativo: Number(cfg.topeRemunerativo) || 0 },
  };
}
