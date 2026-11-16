/**
 * FICHA DE PERSONAL en PDF (A4, una hoja). Estructura:
 *   cabecera (empleador + título) · tarjeta de identidad · 1) datos personales ·
 *   2) relación laboral · 3) remuneración · 4) cobro y cobertura · 5) observaciones ·
 *   6) últimas liquidaciones · firmas · pie.
 * Sin DOM: recibe los datos ya resueltos y devuelve el documento jsPDF.
 */
import { dateAR, number, todayISO } from '../../core/format.js';
import { CONVENIOS } from '../../domain/legal/articles.js';
import { calcAntiguedad } from '../../domain/liquidation/rules/antiguedad.js';
import { APP } from '../../config/app.config.js';
import { C, PAGE, D, fs, pd, t, m$, table, header, section, paragraph, signatures, footer } from './common.js';

/** Cuadro rótulo/valor en 4 columnas (rótulos más anchos que en los recibos, para que no se partan). */
function infoBox(doc, y, pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) rows.push([pairs[i][0], t(pairs[i][1] || '-'), pairs[i + 1]?.[0] ?? '', pairs[i + 1] ? t(pairs[i + 1][1] || '-') : '']);
  const lab = { fontStyle: 'bold', cellWidth: 39, textColor: C.muted, fillColor: C.soft };
  return table(doc, {
    startY: y, body: rows,
    styles: { fontSize: fs(7.4), cellPadding: { top: pd(0.7), bottom: pd(0.7), left: 1.8, right: 1.5 } },
    columnStyles: { 0: lab, 1: { cellWidth: 'auto' }, 2: lab, 3: { cellWidth: 'auto' } },
  });
}

const CONTRATOS = { indeterminado: 'Tiempo indeterminado', plazo_fijo: 'Plazo fijo', eventual: 'Eventual', temporada: 'De temporada', pasantia: 'Pasantía' };
const JORNADAS = { completa: 'Completa', parcial: 'Parcial', reducida: 'Reducida' };
const fechaLarga = (iso) => dateAR(iso);

function edad(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number), n = new Date();
  let a = n.getFullYear() - y;
  if (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d)) a--;
  return a >= 0 && a < 120 ? `${a} años` : '';
}

function antiguedad(e) {
  if (!e.fechaIngreso) return '';
  const fin = e.fechaEgreso && e.fechaEgreso < todayISO() ? e.fechaEgreso : todayISO();
  if (e.fechaIngreso > fin) return '';
  try { return calcAntiguedad(e.fechaIngreso, fin).texto; } catch { return ''; }
}

const pctTxt = (v) => (v ? `${String(number(v))} %` : '');

/** Tarjeta de identidad: iniciales, nombre, estado y datos clave. Devuelve la Y siguiente. */
function identidad(doc, y, e, pas) {
  const { m, w } = PAGE;
  const h = 6 + 14 * D.k;
  doc.setFillColor(...C.soft).setDrawColor(...C.line).setLineWidth(0.2).roundedRect(m, y, w - m * 2, h, 1.5, 1.5, 'FD');
  doc.setFillColor(...C.brand).rect(m, y, 1.6, h, 'F');
  const r = h * 0.33, cx = m + 7 + r, cy = y + h / 2;
  let conFoto = false;
  if (e.foto) {
    try {
      doc.addImage(e.foto, /^data:image\/png/.test(e.foto) ? 'PNG' : 'JPEG', cx - r, cy - r, r * 2, r * 2);
      doc.setDrawColor(...C.brand).setLineWidth(0.5).roundedRect(cx - r, cy - r, r * 2, r * 2, 1.5, 1.5, 'S');
      conFoto = true;
    } catch { conFoto = false; }
  }
  if (!conFoto) {
    doc.setFillColor(...C.brand).circle(cx, cy, r, 'F');
    const ini = t(e.nombre || '?').trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '?';
    doc.setTextColor(...C.white).setFont('helvetica', 'bold').setFontSize(fs(13)).text(ini, cx, cy + fs(13) * 0.14, { align: 'center' });
  }

  const x0 = cx + r + 5;
  doc.setTextColor(...C.ink).setFont('helvetica', 'bold').setFontSize(fs(14));
  let nom = t(e.nombre || '-');
  while (doc.getTextWidth(nom) > w - m - x0 - 50 && nom.length > 6) nom = nom.slice(0, -2);
  doc.text(nom === t(e.nombre) ? nom : `${nom}...`, x0, cy - 1.2 * D.k);
  doc.setFont('helvetica', 'normal').setFontSize(fs(8)).setTextColor(...C.muted);
  const meta = [e.legajo && `Legajo ${e.legajo}`, e.dni && `DNI ${e.dni}`, e.cuil && `CUIL ${e.cuil}`].filter(Boolean).join('   |   ');
  doc.text(t(meta || 'Sin datos de identificación'), x0, cy + 3.6 * D.k);

  // Sello de estado (derecha)
  const activo = !e.fechaEgreso;
  const label = activo ? 'ACTIVO' : 'EGRESADO';
  doc.setFont('helvetica', 'bold').setFontSize(fs(8));
  const bw = doc.getTextWidth(label) + 8, bh = 5.4;
  const bx = w - m - bw - 4, by = cy - 1.2 * D.k - 3.6;
  doc.setFillColor(...(activo ? [220, 252, 231] : [232, 237, 245])).roundedRect(bx, by, bw, bh, 2.7, 2.7, 'F');
  doc.setTextColor(...(activo ? [22, 101, 52] : [71, 85, 105])).text(label, bx + bw / 2, by + 3.8, { align: 'center' });
  if (pas) {
    doc.setFont('helvetica', 'bold').setFontSize(fs(7)).setTextColor(...C.brand).text('PASANTE', bx + bw / 2, by + bh + 3.6, { align: 'center' });
  }
  doc.setTextColor(...C.ink);
  return y + h + 2.5;
}

function drawFicha(doc, { emp: e, historial = [], estudio = {}, userName = '' }) {
  const pas = e.regimen === 'pasantia';
  const convenio = CONVENIOS.find((c) => c.id === e.convenio)?.nombre || e.convenio || '';

  let y = header(doc, {
    emisor: estudio.razonSocial || userName || APP.name, estudio, titulo: 'FICHA DE PERSONAL',
    subtitulo: pas ? 'Pasantía educativa - Ley 26.427' : 'Legajo del trabajador',
    lineas: [`Emitida el ${dateAR(todayISO())}`, e.legajo ? `Legajo N.º ${e.legajo}` : ''].filter(Boolean),
  });
  y = identidad(doc, y + 0.5, e, pas);

  y = section(doc, y, 'DATOS PERSONALES', 1);
  y = infoBox(doc, y, [
    ['Apellido y nombre', e.nombre], ['DNI', e.dni],
    ['CUIL', e.cuil], ['Fecha de nacimiento', e.fechaNac ? `${fechaLarga(e.fechaNac)}${edad(e.fechaNac) ? ` (${edad(e.fechaNac)})` : ''}` : ''],
    ['Domicilio', e.domicilio], ['Teléfono', e.telefono],
    ['Correo electrónico', e.email],
  ]) + 1.8;

  y = section(doc, y, pas ? 'DATOS DE LA PASANTÍA' : 'RELACIÓN LABORAL', 2);
  const laboral = [
    ['Régimen', pas ? 'Pasantía educativa (Ley 26.427)' : 'Relación de dependencia'], ['Sector', e.sector],
    ['Fecha de ingreso', fechaLarga(e.fechaIngreso)], ['Antigüedad', antiguedad(e)],
    ['Categoría / tarea', e.categoria], ['Convenio colectivo', convenio],
  ];
  if (pas) {
    laboral.push(['Institución educativa', e.institucion], ['Carrera', e.carrera], ['Convenio marco / acuerdo', e.convenioMarco], ['Finalización prevista', e.fechaFin ? fechaLarga(e.fechaFin) : ''], ['Tutor institucional', e.tutorInst], ['Tutor de la empresa', e.tutorEmpresa]);
  } else {
    laboral.push(['Tipo de contrato', CONTRATOS[e.tipoContrato] || ''], ['Jornada', JORNADAS[e.jornada] || ''], ['Horas semanales', e.horasSemanales ? `${e.horasSemanales} hs` : '48 hs (por defecto)'], ['Periodicidad de pago', e.periodicidad === 'quincenal' ? 'Quincenal' : 'Mensual']);
    if (e.fechaFin) laboral.push(['Finalización prevista', fechaLarga(e.fechaFin)]);
  }
  if (e.fechaEgreso) laboral.push(['Fecha de egreso', fechaLarga(e.fechaEgreso)]);
  y = infoBox(doc, y, laboral) + 1.8;

  y = section(doc, y, pas ? 'ASIGNACIÓN ESTÍMULO' : 'REMUNERACIÓN', 3);
  const hora = !pas && e.modalidad === 'hora';
  const rem = [
    ['Forma de liquidación', pas ? 'Asignación estímulo mensual' : hora ? 'Jornalizado (por hora trabajada)' : 'Mensualizado'],
    hora ? ['Valor hora', `${m$(e.valorHoraEfectivo ?? e.valorHora)} / h${e.zona ? ` - Zona ${e.zona}` : ''}`] : [pas ? 'Asignación mensual' : 'Remuneración bruta mensual', m$(e.sueldo)],
  ];
  if (!pas) rem.push(['Antigüedad (% por año)', e.adicionalAntiguedadPct && !hora ? `${pctTxt(e.adicionalAntiguedadPct)}` : ''], ['Presentismo', pctTxt(e.presentismoPct)]);
  if (hora) rem.push(['Afiliado al sindicato', e.afiliado ? 'Sí' : 'No']);
  y = infoBox(doc, y, rem) + 1.8;

  y = section(doc, y, 'COBRO Y COBERTURA', 4);
  y = infoBox(doc, y, [
    ['Banco', e.banco], ['CBU / CVU', e.cbu],
    ['Obra social', e.obraSocial], ['ART', e.art],
  ]) + 1.8;

  let n = 5;
  if (e.notas) { y = section(doc, y, 'OBSERVACIONES', n++); y = paragraph(doc, y + 4.6 * D.k, { text: e.notas, size: 8 }) + 1; }

  if (historial.length) {
    y = section(doc, y, 'ÚLTIMAS LIQUIDACIONES', n);
    y = table(doc, {
      startY: y,
      head: [['Período', 'Tipo', 'Bruto', 'Descuentos', 'Neto', 'Pago']],
      body: historial.map((h) => [t(h.label), t(h.tipo || ''), m$(h.bruto), m$(h.descuentos), m$(h.neto), h.pagado ? `Pagado${h.fechaPago ? ` ${dateAR(h.fechaPago)}` : ''}` : 'Pendiente']),
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 22 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' }, 5: { cellWidth: 'auto' } },
      didParseCell: (d) => { if (d.section === 'head' && [2, 3, 4].includes(d.column.index)) d.cell.styles.halign = 'right'; },
    }) + 1.5;
  }
  signatures(doc, y, 'Firma del empleador', 'Firma del trabajador');
}

/** Una sola hoja A4: se comprime la densidad lo justo y necesario para que entre completa. */
export function buildFichaPDF(J, data) {
  // La ficha es corta: arranca "holgada" (k > 1) y se comprime solo si el contenido no entra.
  let k = 0.68;
  for (const step of [1.3, 1.22, 1.15, 1.08, 1, 0.92, 0.85, 0.78, 0.72, 0.68]) {
    D.k = step;
    const tmp = new J({ unit: 'mm', format: 'a4' });
    drawFicha(tmp, data);
    if (tmp.getNumberOfPages() === 1) { k = step; break; }
  }
  D.k = 1;
  const doc = new J({ unit: 'mm', format: 'a4' });
  D.k = k;
  drawFicha(doc, data);
  D.k = 1;
  footer(doc, `Ficha de personal - documento interno de uso administrativo. Datos al ${dateAR(todayISO())}. Generado con ${APP.name} ${APP.edition}.`);
  return doc;
}

