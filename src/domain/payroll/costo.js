/**
 * Composición del COSTO LABORAL (Decreto 407/2026, resumen del recibo):
 * contribuciones del empleador + aportes del trabajador + remuneración neta.
 * Función pura, usada por los recibos de haberes y por la liquidación final.
 */
import { round2 } from '../../core/format.js';

/** Contribuciones a cargo del empleador y el rubro del resumen al que pertenecen. */
export const CONTRIB_DEF = [
  { id: 'sipa', label: 'SIPA (jubilación)', rubro: 'Seguridad social' },
  { id: 'asignaciones', label: 'Asignaciones familiares', rubro: 'Seguridad social' },
  { id: 'fne', label: 'Fondo Nacional de Empleo', rubro: 'Seguridad social' },
  { id: 'pami', label: 'INSSJP (Ley 23.568)', rubro: 'INSSJP' },
  { id: 'obraSocial', label: 'Obra social', rubro: 'Obra social' },
  { id: 'art', label: 'ART', rubro: 'ART' },
  { id: 'sindical', label: 'Contribución sindical / solidaria', rubro: 'Sindical' },
  { id: 'uocra', label: 'Contribución empresarial UOCRA', rubro: 'Sindical' },
  { id: 'fondoCese', label: 'Fondo de Cese Laboral (Ley 22.250, art. 15)', rubro: 'Fondo de cese laboral' },
  { id: 'ieric', label: 'IERIC (Ley 22.250, art. 12)', rubro: 'IERIC' },
  { id: 'camaras', label: 'Cámaras empresariales', rubro: 'Cámaras empresariales' },
  { id: 'otros', label: 'Otras contribuciones', rubro: 'Otros' },
];
export const RUBROS = ['Seguridad social', 'INSSJP', 'Obra social', 'ART', 'Sindical', 'Fondo de cese laboral', 'IERIC', 'Cámaras empresariales', 'Seguro de vida', 'Otros'];

// Todo descuento propio del trabajador que integra el recibo (excepto ausencias, adelantos y otros descuentos, que no son aportes).
// Incluye la obra social adicional y el seguro de vida del jornalero: antes se omitían y el neto del resumen no coincidía con el del recibo.
const APORTES_FIJOS = ['jubilacion', 'pami', 'obra_social', 'sindicato', 'solidario', 'os_adic', 'seguro_vida'];
const esAporteLey = (d) => /^ap_/.test(d.id) || APORTES_FIJOS.includes(d.id);
const rubroAporte = (id) => (/jubilacion/.test(id) ? 'Seguridad social' : /pami/.test(id) ? 'INSSJP' : /seguro_vida/.test(id) ? 'Seguro de vida' : /obra|os_adic/i.test(id) ? 'Obra social' : 'Sindical');

/** Estilos del gráfico del resumen: barra formal (por defecto), torta o sin gráfico. */
export const ESTILOS_GRAFICO = [['barra', 'Barra de proporciones (formal, recomendado)'], ['torta', 'Torta'], ['ninguno', 'Sin gráfico (solo tabla)']];
export const estiloGrafico = (estudio) => (ESTILOS_GRAFICO.some(([k]) => k === estudio?.grafico) ? estudio.grafico : 'barra');
export const PALETA_FORMAL = [[31, 41, 55], [75, 85, 99], [107, 114, 128], [140, 148, 160], [170, 177, 187], [198, 203, 211], [222, 226, 231], [238, 240, 243]];
/** Color de texto legible sobre un fondo dado. */
export const textoSobre = (c) => ((c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 < 150 ? [255, 255, 255] : [17, 24, 39]);
export const PALETA = [[0, 82, 204], [14, 165, 233], [99, 102, 241], [16, 185, 129], [245, 158, 11], [239, 68, 68], [168, 85, 247], [236, 72, 153], [100, 116, 139], [20, 184, 166], [234, 179, 8]];

/** Contribuciones del empleador concepto por concepto (cada una redondeada a centavos). */
export function contribucionesEmpleador(baseAportes, patronales = {}) {
  return CONTRIB_DEF.map((d) => ({ ...d, pct: Number(patronales[d.id]) || 0 }))
    .filter((c) => c.pct > 0)
    .map((c) => ({ ...c, base: round2(baseAportes), monto: round2((baseAportes * c.pct) / 100) }));
}

/**
 * @param {object} p { bruto, baseAportes, ausencias, deducciones[], patronales{} }
 */
export function costoLaboral({ bruto, baseAportes = 0, ausencias = 0, deducciones = [], patronales = {}, estilo = 'barra', neto = null }) {
  const paleta = estilo === 'torta' ? PALETA : PALETA_FORMAL;
  const contribuciones = contribucionesEmpleador(baseAportes, patronales);
  const totalContribuciones = round2(contribuciones.reduce((a, c) => a + c.monto, 0));
  const aportes = deducciones.filter(esAporteLey).map((d) => ({ rubro: rubroAporte(d.id), label: d.label, monto: d.amount }));
  const totalAportes = round2(aportes.reduce((a, x) => a + x.monto, 0));
  const costoTotal = round2(bruto - ausencias + totalContribuciones);
  // Si el recibo informa su NETO, el resumen lo toma tal cual; lo que falte hasta (bruto − ausencias − aportes) son
  // adelantos y otros descuentos, que se muestran como fila propia para que todo cierre al 100 %.
  const netoTrabajador = neto == null ? round2(bruto - ausencias - totalAportes) : round2(neto);
  const otrosDescuentos = neto == null ? 0 : Math.max(0, round2(bruto - ausencias - totalAportes - netoTrabajador));

  // Tabla del resumen: una fila por rubro con aporte del trabajador y contribución del empleador
  const filas = RUBROS.map((rubro) => {
    const ap = round2(aportes.filter((a) => a.rubro === rubro).reduce((s, a) => s + a.monto, 0));
    const co = round2(contribuciones.filter((c) => c.rubro === rubro).reduce((s, c) => s + c.monto, 0));
    return { rubro, aporte: ap, contribucion: co, total: round2(ap + co) };
  }).filter((f) => f.total > 0);

  const slices = [{ label: 'Remuneración neta', monto: netoTrabajador },
    ...(otrosDescuentos > 0 ? [{ label: 'Adelantos y otros descuentos', monto: otrosDescuentos }] : []),
    ...filas.map((f) => ({ label: f.rubro, monto: f.total, aporte: f.aporte, contribucion: f.contribucion }))]
    .filter((x) => x.monto > 0)
    .map((x, i) => ({ ...x, pct: costoTotal > 0 ? (x.monto / costoTotal) * 100 : 0, color: paleta[i % paleta.length] }));

  const cuadra = round2(totalAportes + totalContribuciones + netoTrabajador + otrosDescuentos) === costoTotal;
  return { estilo, contribuciones, totalContribuciones, aportes, totalAportes, costoTotal, netoTrabajador, otrosDescuentos, cuadra, filas, slices };
}
