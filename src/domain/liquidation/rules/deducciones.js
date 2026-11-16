import { round2 } from '../../../core/format.js';

/** Aportes del trabajador: solo sobre conceptos remunerativos, con tope opcional. */
export function deducciones(remunerativo, settings) {
  const a = settings.aportes;
  const tope = Number(settings.topeRemunerativo) || 0;
  const base = tope > 0 ? Math.min(remunerativo, tope) : remunerativo;
  const filas = [
    ['jubilacion', 'Jubilación (SIPA)', a.jubilacion],
    ['pami', 'Ley 23.568 (INSSJP)', a.pami],
    ['obra_social', 'Obra social', a.obraSocial],
    ['sindicato', 'Cuota sindical', a.sindicato],
  ];
  return filas.filter(([, , pct]) => Number(pct) > 0).map(([id, label, pct]) => ({
    id, label, pct: Number(pct), base: round2(base), amount: round2(base * (Number(pct) / 100)),
  }));
}
