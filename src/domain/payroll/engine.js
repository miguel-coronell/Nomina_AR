/**
 * MOTOR DE NÓMINA — recibo de haberes de un empleado en un período.
 * Función pura: calcularLinea(snapshot, novedades, periodo, params) → línea.
 */
import { round2, money } from '../../core/format.js';
import { parseISO } from '../../core/dates.js';
import { calcAntiguedad } from '../liquidation/rules/antiguedad.js';
import { factorTrabajado } from './periodos.js';
import { contribucionesEmpleador } from './costo.js';
import { jornadaPeriodo } from './jornada.js';
import { baseMinimaSipa } from '../legal/params.js';
import { basicoSerenoZonaA } from '../convenios/escalas.js';

export const NOVEDADES_VACIAS = { hsNormales: 0, he50: 0, he100: 0, ausenciasInjustificadas: 0, sinGoce: 0, feriadosTrabajados: 0, hsDescontar: 0, bono: 0, noRemunerativo: 0, adelanto: 0, otrosDescuentos: 0, mejorRemuneracion: 0, nota: '' };

const n = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) && x > 0 ? x : 0; };
export const normalizarNovedades = (v = {}) => ({
  hsNormales: n(v.hsNormales), he50: n(v.he50), he100: n(v.he100), ausenciasInjustificadas: n(v.ausenciasInjustificadas), sinGoce: n(v.sinGoce), feriadosTrabajados: n(v.feriadosTrabajados), hsDescontar: n(v.hsDescontar), bono: n(v.bono),
  noRemunerativo: n(v.noRemunerativo), adelanto: n(v.adelanto), otrosDescuentos: n(v.otrosDescuentos),
  mejorRemuneracion: n(v.mejorRemuneracion), nota: String(v.nota || '').slice(0, 200),
});

/** Divisor del valor hora: explícito, o proporcional a las horas semanales (48 hs → 200). */
export const divisorHoraDe = (hs, explicito) => (Number(explicito) > 0 ? Number(explicito) : Number(hs) > 0 ? Math.round(((Number(hs) * 25) / 6) * 100) / 100 : 200);

/** Horas hábiles del período (lunes a viernes sin feriados, o el horario de la ficha), desde el ingreso hasta la baja. */
export const horasPeriodo = (snap, p, ajustesFeriados) => jornadaPeriodo(snap, p, ajustesFeriados).horas;

export const snapshotEmpleado = (e) => ({
  sueldo: Number(e.sueldo) || 0, fechaIngreso: e.fechaIngreso, fechaEgreso: e.fechaEgreso || '',
  adicionalAntiguedadPct: Number(e.adicionalAntiguedadPct) || 0, presentismoPct: Number(e.presentismoPct) || 0,
  regimen: e.regimen === 'pasantia' ? 'pasantia' : 'dependencia', horasSemanales: Number(e.horasSemanales) || 0,
  divisorHora: divisorHoraDe(e.horasSemanales, e.divisorHora),
  modalidad: e.modalidad === 'hora' ? 'hora' : 'mensual', valorHora: Number(e.valorHora) || 0, afiliado: !!e.afiliado,
  ...(e.horario ? { horario: e.horario } : {}), zona: e.zona || 'A', convenio: e.convenio || '',
});

/** Rubros de jornalero propios de la construcción (Ley 22.250, CCT 76/75): ficha sin convenio (como hasta ahora) o convenio Construcción. */
export const esConstruccion = (snap) => !snap.convenio || snap.convenio === 'construccion';

/** Las contribuciones de un pasante se limitan a obra social y ART (Ley 26.427 y Dto. 491/96). */
export const patronalesDe = (snap, params, anios = 0) => {
  const pat = params.patronales || {};
  if (snap.regimen === 'pasantia') return Object.fromEntries(['obraSocial', 'art'].map((k) => [k, pat[k] || 0]));
  const { fondoCese2, ...resto } = pat;
  // Contribuciones propias de la construcción (Ley 22.250 y CCT 76/75): solo personal jornalizado.
  // Fondo de Cese Laboral: 12 % el primer año de antigüedad y 8 % desde el segundo (art. 15).
  if (snap.modalidad !== 'hora' || !esConstruccion(snap)) return { ...resto, fondoCese: 0, ieric: 0, uocra: 0 };
  return { ...resto, fondoCese: anios >= 1 ? Number(fondoCese2) || 0 : Number(pat.fondoCese) || 0 };
};

/** Días corridos del mes del período en que el trabajador estuvo en relación (según ingreso y baja), con tope de 30. */
export function diasTrabajadosMes(snap, p) {
  const [y, m] = String(p.hasta).split('-').map(Number);
  const primero = `${y}-${String(m).padStart(2, '0')}-01`;
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const ini = snap.fechaIngreso && snap.fechaIngreso > primero ? snap.fechaIngreso : primero;
  const fin = snap.fechaEgreso && snap.fechaEgreso < ultimo ? snap.fechaEgreso : ultimo;
  const dias = Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${ini}T00:00:00Z`)) / 86400000) + 1;
  return Math.min(30, Math.max(0, dias));
}

export const totalPatronal = (pat = {}) => Object.values(pat).reduce((a, v) => a + (Number(v) || 0), 0);

export function calcularLinea(snap, novedadesRaw, p, params) {
  const nov = normalizarNovedades(novedadesRaw);
  const cal = factorTrabajado(snap, p);
  // Quincenas, meses y años: se cuentan DÍAS HÁBILES (lun-vie sin feriados, según la ficha). Pasantía y SAC siguen por días corridos.
  const jor = p.tipo !== 'sac' && snap.regimen !== 'pasantia' ? jornadaPeriodo(snap, p, params?.feriados) : null;
  const habil = !!(jor && jor.diasPeriodo > 0);
  const factor = habil ? jor.dias / jor.diasPeriodo : cal.factor;
  const dias = habil ? jor.dias : cal.dias, diasPeriodo = habil ? jor.diasPeriodo : cal.diasPeriodo;
  const warnings = [];
  const rubros = [];
  const add = (id, label, amount, tipo = 'remunerativo', meta = {}) => { if (amount > 0) rubros.push({ id, label, amount: round2(amount), tipo, ...meta }); };

  const finAnt = snap.fechaEgreso && snap.fechaEgreso < p.hasta ? snap.fechaEgreso : p.hasta;
  const anios = snap.fechaIngreso <= finAnt ? calcAntiguedad(snap.fechaIngreso, finAnt).years : 0;
  const antigMensualPct = snap.adicionalAntiguedadPct * anios; // % acumulado
  const porHora = snap.modalidad === 'hora' && snap.regimen !== 'pasantia' && p.tipo !== 'sac';
  const remMensual = porHora ? 0 : snap.sueldo * (1 + antigMensualPct / 100);
  const parcial = !porHora && factor < 1;
  // Horas normales del jornalero: lo cargado a mano o, si está vacío, las horas hábiles del período (menos ausencias y licencias sin goce).
  const hsPorDia = jor && jor.dias ? jor.horas / jor.dias : 8;
  const hsAuto = jor ? Math.max(0, round2(jor.horas - (nov.ausenciasInjustificadas + nov.sinGoce) * hsPorDia)) : 0;
  const hsNorm = nov.hsNormales > 0 ? nov.hsNormales : hsAuto;
  if (porHora) { if (!(snap.valorHora > 0)) warnings.push('Falta el valor hora: cargalo en la ficha o elegí convenio y categoría.');
    if (!(jor.horas > 0)) warnings.push('Sin días hábiles trabajados en el período: cargá las horas a mano si corresponde.');
    else if (jor.dias < jor.diasPeriodo) warnings.push(`Proporcional: ${jor.dias} de ${jor.diasPeriodo} días hábiles del período = ${jor.horas} hs.`);
    if (nov.hsNormales > 0 && nov.hsNormales !== hsAuto) warnings.push(`Cargaste ${nov.hsNormales} hs; el período tiene ${hsAuto} hs hábiles trabajables (${jor.dias} días hábiles, lunes a viernes sin feriados)${jor.feriadosDias ? `; los ${jor.feriadosDias} feriado(s) (${jor.feriadosHoras} hs) se pagan aparte en el rubro «Feriado pagado»` : ''}. Dejá el campo vacío para usar el cálculo automático.`); }
  else if (factor === 0) warnings.push('Sin días trabajados en el período.');
  else if (parcial) warnings.push(`Proporcional: ${dias} de ${diasPeriodo} días ${habil ? 'hábiles ' : ''}del período.`);

  const pasante = snap.regimen === 'pasantia';
  const vh = porHora ? snap.valorHora : remMensual / (snap.divisorHora || 200);
  let ausenciasDesc = 0, sinGocePesos = 0, hsDescPesos = 0;

  if (pasante) {
    add('asignacion', `Asignación estímulo - pasantía educativa${parcial ? ` (${dias}/${diasPeriodo} días)` : ''}`, snap.sueldo * factor, 'no_remunerativo',
      { cant: parcial ? dias : 30, unidad: 'días', base: round2(snap.sueldo) });
  } else if (porHora) {
    const base = hsNorm * vh;
    add('basico', 'Básico horas normales', base, 'remunerativo', { cant: hsNorm, unidad: 'hs', base: round2(vh) });
    // Feriado nacional no trabajado: el jornalero lo cobra igual (art. 165 LCT). Si se trabaja, se suma el día adicional (art. 166) y queda doble.
    const feriadoPago = jor.feriadosHoras * vh;
    add('feriado_pago', `Feriado pagado (${jor.feriadosDias} ${jor.feriadosDias === 1 ? 'día' : 'días'} × ${round2(jor.feriadosHoras / (jor.feriadosDias || 1))} hs)`, feriadoPago, 'remunerativo', { cant: jor.feriadosHoras, unidad: 'hs', base: round2(vh) });
    if (snap.presentismoPct > 0) {
      if (nov.ausenciasInjustificadas > 0 || nov.sinGoce > 0) warnings.push('Presentismo perdido por ausencias injustificadas o licencia sin goce.');
      else add('presentismo', `Presentismo (${snap.presentismoPct}%)`, (base + feriadoPago) * (snap.presentismoPct / 100), 'remunerativo', { cant: snap.presentismoPct, unidad: '%', base: round2(base + feriadoPago) });
    }
    add('he50', `Horas extras 50% (${nov.he50} hs)`, nov.he50 * vh * 1.5, 'remunerativo', { cant: nov.he50, unidad: 'hs', base: round2(vh * 1.5) });
    add('he100', `Horas extras 100% (${nov.he100} hs)`, nov.he100 * vh * 2, 'remunerativo', { cant: nov.he100, unidad: 'hs', base: round2(vh * 2) });
    add('feriado', `Feriado trabajado - día adicional (${nov.feriadosTrabajados} ${nov.feriadosTrabajados === 1 ? 'día' : 'días'})`, nov.feriadosTrabajados * vh * 8, 'remunerativo', { cant: nov.feriadosTrabajados, unidad: 'días', base: round2(vh * 8) });
    add('bono', 'Adicional / bono remunerativo', nov.bono);
    add('no_rem', 'Adicional no remunerativo', nov.noRemunerativo, 'no_remunerativo');
    hsDescPesos = round2(vh * nov.hsDescontar);
  } else if (p.tipo === 'sac') {
    let mejor = nov.mejorRemuneracion || remMensual;
    if (!nov.mejorRemuneracion && snap.presentismoPct > 0) mejor *= 1 + snap.presentismoPct / 100;
    add('sac', `SAC ${p.semestre === 1 ? '1.er' : '2.º'} semestre${parcial ? ` (proporcional ${dias}/${diasPeriodo})` : ''}`, (mejor / 2) * factor, 'remunerativo', { cant: 50, unidad: '%', base: round2(mejor) });
  } else {
    const base = (p.tipo === 'quincenal' ? snap.sueldo / 2 : snap.sueldo) * factor;
    const antig = base * (antigMensualPct / 100);
    add('basico', `Sueldo básico${p.tipo === 'quincenal' ? ' (quincena)' : ''}${parcial ? ` — ${dias}/${diasPeriodo} días${habil ? ' hábiles' : ''}` : ''}`, base, 'remunerativo', { cant: parcial ? dias : (p.tipo === 'quincenal' ? 15 : 30), unidad: 'días', base: round2(snap.sueldo), hs: jor ? jor.horas : undefined });
    add('antiguedad', `Adicional por antigüedad (${anios} ${anios === 1 ? 'año' : 'años'} × ${snap.adicionalAntiguedadPct}%)`, antig, 'remunerativo', { cant: round2(antigMensualPct), unidad: '%', base: round2(base) });
    const pierdePres = nov.ausenciasInjustificadas > 0 || nov.sinGoce > 0;
    if (snap.presentismoPct > 0) {
      if (pierdePres) warnings.push('Presentismo perdido por ausencias injustificadas o licencia sin goce.');
      else add('presentismo', `Presentismo (${snap.presentismoPct}%)`, (base + antig) * (snap.presentismoPct / 100), 'remunerativo', { cant: snap.presentismoPct, unidad: '%', base: round2(base + antig) });
    }
    add('he50', `Horas extras 50% (${nov.he50} hs)`, nov.he50 * vh * 1.5, 'remunerativo', { cant: nov.he50, unidad: 'hs', base: round2(vh * 1.5) });
    add('he100', `Horas extras 100% (${nov.he100} hs)`, nov.he100 * vh * 2, 'remunerativo', { cant: nov.he100, unidad: 'hs', base: round2(vh * 2) });
    const divF = Number(params.divisorFeriado) || 25;
    add('feriado', `Feriado trabajado - día adicional (art. 166 LCT) (${nov.feriadosTrabajados} ${nov.feriadosTrabajados === 1 ? 'día' : 'días'})`, nov.feriadosTrabajados * (remMensual / divF), 'remunerativo', { cant: nov.feriadosTrabajados, unidad: 'días', base: round2(remMensual / divF) });
    add('bono', 'Adicional / bono remunerativo', nov.bono);
    add('no_rem', 'Adicional no remunerativo', nov.noRemunerativo, 'no_remunerativo');
    ausenciasDesc = round2((remMensual / 30) * nov.ausenciasInjustificadas);
    sinGocePesos = round2((remMensual / 30) * nov.sinGoce);
    hsDescPesos = round2(vh * nov.hsDescontar);
  }

  const remunerativo = round2(rubros.filter((r) => r.tipo === 'remunerativo').reduce((a, r) => a + r.amount, 0));
  const noRemunerativo = round2(rubros.filter((r) => r.tipo === 'no_remunerativo').reduce((a, r) => a + r.amount, 0));
  const reduccionBase = round2(ausenciasDesc + sinGocePesos + hsDescPesos);
  const baseAportesBruta = pasante ? noRemunerativo : Math.max(0, remunerativo - reduccionBase);
  const topeMes = Number(params.topeRemunerativo) || 0;
  const tope = topeMes > 0 ? (p.tipo === 'quincenal' ? topeMes / 2 : topeMes) : 0;
  const baseAportes = round2(tope > 0 ? Math.min(baseAportesBruta, tope) : baseAportesBruta);

  const deducciones = [];
  const ded = (id, label, amount, pct, meta = {}) => { if (amount > 0) deducciones.push({ id, label, amount: round2(amount), ...(pct != null ? { pct, base: baseAportes } : {}), ...meta }); };
  ded('ausencias', `Ausencias injustificadas (${nov.ausenciasInjustificadas} ${nov.ausenciasInjustificadas === 1 ? 'día' : 'días'})`, ausenciasDesc, null, { cant: nov.ausenciasInjustificadas, unidad: 'días', base: round2(remMensual / 30) });
  ded('sin_goce', `Licencia sin goce de haberes (${nov.sinGoce} ${nov.sinGoce === 1 ? 'día' : 'días'})`, sinGocePesos, null, { cant: nov.sinGoce, unidad: 'días', base: round2(remMensual / 30) });
  ded('hs_desc', `Horas no trabajadas (${nov.hsDescontar} hs)`, hsDescPesos, null, { cant: nov.hsDescontar, unidad: 'hs', base: round2(vh) });
  const a = params.aportes || {};
  const j = params.jornal || {};
  if (!pasante) [['jubilacion', 'Jubilación (SIPA)'], ['pami', 'Ley 23.568 (INSSJP)'], ['obraSocial', 'Obra social'], ...(porHora ? [] : [['sindicato', 'Cuota sindical']])]
    .forEach(([k, l]) => ded(`ap_${k}`, l, baseAportes * ((Number(a[k]) || 0) / 100), Number(a[k]) || 0));
  if (porHora && baseAportes > 0) {
    // 405 Obra social adicional (Dto. 488/2011): piso = 2 × base mínima SIPA vigente, proporcional a los días corridos trabajados
    // en el mes. Solo si la remuneración con aportes es MENOR al piso, se descuenta el 3 % de la diferencia.
    const bs = baseMinimaSipa(p.desde);
    if (!bs) warnings.push('No hay una base mínima SIPA cargada para este período: no se pudo evaluar la obra social adicional.');
    else {
      if (bs.desde.slice(0, 7) !== p.desde.slice(0, 7)) warnings.push(`Base mínima SIPA tomada de la vigencia ${bs.desde} (no hay una más reciente cargada).`);
      const pisoProp = round2(((bs.valor * 2) / 30) * diasTrabajadosMes(snap, p));
      const faltante = round2(pisoProp - baseAportes);
      if (faltante > 0) ded('os_adic', 'Obra social adicional jornalero', faltante * 0.03, 3, { base: faltante });
    }
    if (snap.afiliado) ded('sindicato', 'Cuota sindical afiliados', baseAportes * ((Number(j.sindicatoPct) || 0) / 100), Number(j.sindicatoPct) || 0);
    else ded('solidario', 'Aporte solidario (no afiliados)', baseAportes * ((Number(j.solidarioPct) || 0) / 100), Number(j.solidarioPct) || 0);
    // 425 Seguro de vida colectivo (art. 108 CCT 76/75): % del básico mensual Sereno Zona A, en la 2.ª quincena (o en el mes completo).
    if (!esConstruccion(snap)) warnings.push('Convenio distinto de Construcción: no se calcula el seguro de vida de la UOCRA ni los aportes patronales de la construcción. Los % de cuota sindical / aporte solidario salen de Configuración: verificá que correspondan a tu convenio.');
    if (esConstruccion(snap) && !(p.tipo === 'quincenal' && Number(p.quincena) !== 2)) {
      const sv = basicoSerenoZonaA(p.desde);
      if (!sv) warnings.push('No hay un básico Sereno Zona A cargado: no se pudo calcular el seguro de vida.');
      else {
        if (sv.desde.slice(0, 7) !== p.desde.slice(0, 7)) warnings.push(`Seguro de vida calculado con el básico Sereno Zona A de la vigencia ${sv.desde} (no hay uno más reciente cargado).`);
        const pctSv = Number(j.seguroVidaPct) || 0;
        ded('seguro_vida', 'Seguro de vida colectivo', sv.valor * (pctSv / 100), pctSv, { base: sv.valor });
      }
    }
  }
  ded('adelanto', 'Adelanto / anticipo de sueldo', nov.adelanto);
  ded('otros', 'Otros descuentos', nov.otrosDescuentos);

  const descuentos = round2(deducciones.reduce((s, d) => s + d.amount, 0));
  {   // 980 Redondeo: el neto de TODOS los recibos cierra en pesos enteros
    const previo = round2(remunerativo + noRemunerativo - descuentos);
    const red = round2(Math.ceil(previo - 1e-9) - previo);
    if (red > 0) rubros.push({ id: 'redondeo', label: 'Redondeo', amount: red, tipo: 'no_remunerativo' });
  }
  const noRemTot = round2(rubros.filter((r) => r.tipo === 'no_remunerativo').reduce((a, r) => a + r.amount, 0));
  const bruto = round2(remunerativo + noRemTot);
  const neto = round2(bruto - descuentos);
  if (neto < 0) warnings.push(`El neto es negativo (${money(neto)}): revisá adelantos y descuentos.`);
  const patronales = patronalesDe(snap, params, anios);
  const patronal = round2(contribucionesEmpleador(baseAportes, patronales).reduce((x, c) => x + c.monto, 0));

  return {
    rubros, deducciones, warnings, patronales,
    totals: { bruto, remunerativo, noRemunerativo: noRemTot, descuentos, neto, patronal, costo: round2(bruto - reduccionBase + patronal), ausencias: reduccionBase, baseAportes },
  };
}
