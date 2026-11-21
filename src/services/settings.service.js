import { DEFAULT_TEMPLATES } from './share.service.js';

const DOC = 'settings';

export const DEFAULT_SETTINGS = {
  aportes: { jubilacion: 11, pami: 3, obraSocial: 3, sindicato: 2 },
  // Contribuciones patronales (% sobre remuneraciones). Valores de REFERENCIA: verificar con tu estudio contable.
  // Solo para personal jornalizado (construcción): fondoCese (12 % el 1.er año) y fondoCese2 (8 % desde el 2.º, Ley 22.250 art. 15),
  // uocra (contribución empresarial UOCRA) e ieric (aporte IERIC).
  patronales: { sipa: 10.77, pami: 1.59, asignaciones: 4.44, fne: 0.94, obraSocial: 6, art: 2, sindical: 0, uocra: 2, fondoCese: 12, fondoCese2: 8, ieric: 1, camaras: 0, otros: 0 },
  // Personal por hora (jornaleros). La obra social adicional NO es un parámetro: se calcula con la base mínima SIPA vigente
  // (domain/legal/params.js). El seguro de vida es un % del básico Sereno Zona A (domain/convenios/escalas.js).
  // sindicatoATodos: la empresa descuenta «SDTO UOCRA AFILIADOS» (sindicatoPct) a TODO el personal jornalizado de la construcción, como en sus recibos;
  // si se desactiva, solo a los que tienen tildado «Afiliado» en la ficha y el resto paga el aporte solidario.
  jornal: { sindicatoPct: 2.5, solidarioPct: 2, seguroVidaPct: 2, sindicatoATodos: true },
  divisorFeriado: 25,        // valor del día adicional por feriado trabajado = remuneración / divisor (mensualizados)
  topeRemunerativo: 0,       // 0 = sin tope
  periodoPruebaMeses: 0,     // 0 = automático según fecha de egreso
  // Mensajes predeterminados al compartir por WhatsApp / correo (variables: {nombre} {periodo} {neto} {fecha} {motivo} {empresa}).
  mensajes: { ...DEFAULT_TEMPLATES },
  // Escalas y valores con fecha de vigencia que carga el usuario (pantalla «Escalas y vigencias»). Se suman a los de fábrica.
  tablas: { convenios: {}, basesSipa: [], sereno: [] },
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
