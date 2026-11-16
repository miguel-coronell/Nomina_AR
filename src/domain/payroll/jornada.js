/**
 * JORNADA DE UN PERÍODO — días hábiles y horas, para cualquier quincena, mes o año.
 * Día hábil = día con jornada pactada en la ficha (horario explícito, o las horas semanales de la ficha repartidas de lunes a viernes; por defecto 8 hs) que no es feriado nacional.
 * Respeta el ingreso y la baja del empleado: `dias`/`horas` son los del tramo trabajado; `diasPeriodo`/`horasPeriodo`, los del período completo.
 * Los feriados salen del calendario automático (domain/hr/feriados.js) más los ajustes del usuario (`ajustesFeriados`).
 */
import { round2 } from '../../core/format.js';
import { normalizarHorario, horasPactadas, horarioDeFicha } from '../hr/horario.js';
import { feriadosEntre } from '../hr/feriados.js';

export function jornadaPeriodo(snap, p, ajustesFeriados) {
  const feriados = feriadosEntre(p.desde, p.hasta, ajustesFeriados);
  const horario = normalizarHorario(horarioDeFicha(snap));
  const ini = snap.fechaIngreso && snap.fechaIngreso > p.desde ? snap.fechaIngreso : p.desde;
  const fin = snap.fechaEgreso && snap.fechaEgreso < p.hasta ? snap.fechaEgreso : p.hasta;
  let dias = 0, horas = 0, diasPeriodo = 0, horasPeriodo = 0, feriadosDias = 0, feriadosHoras = 0;
  for (let d = new Date(`${p.desde}T12:00:00Z`); isoDe(d) <= p.hasta; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = isoDe(d), h = horasPactadas(horario, iso);
    if (!h) continue;
    if (feriados.get(iso)?.tipo === 'feriado') {
      // Feriado en día laborable: no es día hábil trabajado, pero se paga igual (art. 165 LCT) si cae dentro del vínculo.
      if (iso >= ini && iso <= fin) { feriadosDias += 1; feriadosHoras += h; }
      continue;
    }
    diasPeriodo += 1; horasPeriodo += h;
    if (iso >= ini && iso <= fin) { dias += 1; horas += h; }
  }
  return { dias, horas: round2(horas), diasPeriodo, horasPeriodo: round2(horasPeriodo), feriadosDias, feriadosHoras: round2(feriadosHoras) };
}
const isoDe = (d) => d.toISOString().slice(0, 10);
