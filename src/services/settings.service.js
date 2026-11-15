import { DEFAULT_TEMPLATES } from './share.service.js';

const DOC = 'settings';

export const DEFAULT_SETTINGS = {
  aportes: { jubilacion: 11, pami: 3, obraSocial: 3, sindicato: 2 },
  // Contribuciones patronales (% sobre remuneraciones). Valores de REFERENCIA: verificar con tu estudio contable.
  patronales: { sipa: 10.77, pami: 1.59, asignaciones: 4.44, fne: 0.94, obraSocial: 6, art: 2, sindical: 0, camaras: 0, otros: 0 },
  // Personal por hora (jornaleros): conceptos propios del convenio. Valores tomados de un recibo real: VERIFICAR.
  jornal: { osAdicPct: 0.6161, sindicatoPct: 2.5, seguroVida: 20349.7, redondeo: true },
  divisorFeriado: 25,        // valor del día adicional por feriado trabajado = remuneración / divisor (mensualizados)
  topeRemunerativo: 0,       // 0 = sin tope
  periodoPruebaMeses: 0,     // 0 = automático según fecha de egreso
  // Mensajes predeterminados al compartir por WhatsApp / correo (variables: {nombre} {periodo} {neto} {fecha} {motivo} {empresa}).
  mensajes: { ...DEFAULT_TEMPLATES },
  estudio: { razonSocial: '', cuit: '', domicilio: '', matricula: '', lugarPago: '', logo: null, grafico: 'barra' },
};

const merge = (base, over) => {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  }
  return out;
};

export function createSettingsService(repo) {
  return {
    async get() { return merge(DEFAULT_SETTINGS, await repo.getDoc(DOC)); },
    async save(settings) { await repo.setDoc(DOC, settings); return merge(DEFAULT_SETTINGS, settings); },
    async reset() { await repo.setDoc(DOC, DEFAULT_SETTINGS); return structuredClone(DEFAULT_SETTINGS); },
  };
}
