import { parseISO, daysBetween, daysInMonth, maxDate, toISO } from '../../../core/dates.js';
import { round2 } from '../../../core/format.js';
import { calcAntiguedad, superaAnios } from './antiguedad.js';
import { DIVISOR_HORA, DIVISOR_VACACIONES } from '../../legal/params.js';

/** Días trabajados del mes de egreso (base 30; mes completo si egresa el último día). */
export function diasTrabajadosMes({ inp }) {
  const e = parseISO(inp.fechaEgreso);
  const i = parseISO(inp.fechaIngreso);
  const ultimo = daysInMonth(e.y, e.m);
  const desde = i.y === e.y && i.m === e.m ? i.d : 1;
  const dias = e.d - desde + 1;
  const completo = e.d === ultimo && desde === 1;
  const monto = completo ? inp.sueldo : (inp.sueldo / 30) * Math.min(30, dias);
  return [{
    id: 'dias_trabajados',
    label: `Días trabajados del mes (${completo ? 'mes completo' : dias + ' días'})`,
    amount: round2(monto), tipo: 'remunerativo', ref: 'Art. 103 LCT',
  }];
}

export function horasExtras({ inp }) {
  const valorHora = inp.sueldo / DIVISOR_HORA;
  const out = [];
  if (inp.he50 > 0) out.push({
    id: 'he50', label: `Horas extras al 50% (${inp.he50} hs)`,
    amount: round2(inp.he50 * valorHora * 1.5), tipo: 'remunerativo', ref: 'Art. 201 LCT',
  });
  if (inp.he100 > 0) out.push({
    id: 'he100', label: `Horas extras al 100% (${inp.he100} hs)`,
    amount: round2(inp.he100 * valorHora * 2), tipo: 'remunerativo', ref: 'Art. 201 LCT',
  });
  return out;
}

/** SAC proporcional del semestre en que se produce el egreso. */
export function sacProporcional({ inp }) {
  const e = parseISO(inp.fechaEgreso);
  const i = parseISO(inp.fechaIngreso);
  const segundo = e.m >= 7;
  const inicio = { y: e.y, m: segundo ? 7 : 1, d: 1 };
  const fin = segundo ? { y: e.y, m: 12, d: 31 } : { y: e.y, m: 6, d: 30 };
  const desde = maxDate(inicio, i);
  const dias = daysBetween(desde, e) + 1;
  const total = daysBetween(inicio, fin) + 1;
  return [{
    id: 'sac_prop', label: `SAC proporcional (${dias}/${total} días del ${segundo ? '2.º' : '1.er'} semestre)`,
    amount: round2((inp.sueldo / 2) * (dias / total)), tipo: 'remunerativo', ref: 'Ley 23.041',
  }];
}

/** Días de vacaciones por antigüedad al 31/12 (Art. 150). */
export function diasVacacionesCorrespondientes(inp) {
  const e = parseISO(inp.fechaEgreso);
  const al31 = calcAntiguedad(inp.fechaIngreso, toISO({ y: e.y, m: 12, d: 31 }));
  if (superaAnios(al31, 20)) return 35;
  if (superaAnios(al31, 10)) return 28;
  if (superaAnios(al31, 5)) return 21;
  return 14;
}

/** Vacaciones no gozadas proporcionales + SAC sobre las mismas. */
export function vacacionesNoGozadas({ inp }) {
  const e = parseISO(inp.fechaEgreso);
  const i = parseISO(inp.fechaIngreso);
  const correspondientes = diasVacacionesCorrespondientes(inp);
  const desde = maxDate({ y: e.y, m: 1, d: 1 }, i);
  const diasTrab = daysBetween(desde, e) + 1;
  const proporcional = (correspondientes * diasTrab) / 365;
  const pendientes = Math.max(0, proporcional - (inp.diasVacacionesGozadas || 0));
  if (pendientes <= 0) return [];
  const monto = (inp.sueldo / DIVISOR_VACACIONES) * pendientes;
  return [
    {
      id: 'vacaciones', label: `Vacaciones no gozadas (${pendientes.toFixed(2).replace('.', ',')} días)`,
      detail: `${correspondientes} días anuales × ${diasTrab}/365`, amount: round2(monto), tipo: 'remunerativo', ref: 'Arts. 150 y 156 LCT',
    },
    { id: 'sac_vacaciones', label: 'SAC s/ vacaciones no gozadas', amount: round2(monto / 12), tipo: 'remunerativo', ref: 'Art. 156 LCT' },
  ];
}
