/** Utilidades compartidas por los generadores de PDF (jsPDF + autoTable). Sin DOM. */
import { money } from '../../core/format.js';
import { textoSobre } from '../../domain/payroll/costo.js';

export const C = {
  ink: [17, 24, 39], muted: [107, 114, 128], line: [209, 213, 219], soft: [243, 244, 246],
  brand: [0, 82, 204], white: [255, 255, 255],
};
export const PAGE = { w: 210, h: 297, m: 14, bottom: 17 };

/**
 * DENSIDAD: factor de escala (1 = normal). Los documentos se arman con k=1 y, si ocupan más de
 * una página, se rearman con k menor hasta que entren completos (firma incluida).
 */
export const D = { k: 1 };
export const fs = (n) => Math.max(4.8, n * D.k);
export const pd = (n) => n * D.k;
export const STEPS = [1, 0.95, 0.9, 0.85, 0.8, 0.76, 0.72, 0.68];

/** Menor compresión con la que `draw(doc)` entra en una sola página (o la mayor si no alcanza). */
export function fitK(J, draw, opts = { unit: 'mm', format: 'a4' }) {
  let k = STEPS[STEPS.length - 1];
  for (const step of STEPS) {
    D.k = step;
    const tmp = new J(opts);
    draw(tmp);
    if (tmp.getNumberOfPages() === 1) { k = step; break; }
  }
  D.k = 1;
  return k;
}

/** La fuente estándar del PDF solo soporta Latin-1: normalizamos el resto. */
export const t = (s) => String(s ?? '')
  .replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/[\u2212\u2013\u2014]/g, '-')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, '...')
  .replace(/[^\u0000-\u00ff]/g, '');
export const m$ = (n) => t(money(n));

export const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();

/** Llama a autoTable tanto en el bundle UMD (doc.autoTable) como en módulos. */
export function table(doc, opts) {
  doc.autoTable({
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: fs(7.2), cellPadding: { top: pd(0.55), bottom: pd(0.55), left: 1.5, right: 1.5 }, lineColor: C.line, lineWidth: 0.1, textColor: C.ink, valign: 'top' },
    headStyles: { fillColor: C.soft, textColor: C.ink, fontStyle: 'bold', fontSize: fs(6.8) },
    footStyles: { fillColor: C.soft, textColor: C.ink, fontStyle: 'bold' },
    ...opts,
    margin: { left: PAGE.m, right: PAGE.m, ...(opts.margin || {}), bottom: PAGE.bottom },
  });
  return doc.lastAutoTable.finalY;
}

/** Dibuja el logo ajustado a una caja máxima, conservando proporciones. Devuelve el ancho usado. */
export function drawLogo(doc, logo, x, y, maxW = 34, maxH = 15) {
  if (!logo?.data || !logo.w || !logo.h) return 0;
  const k = Math.min(maxW / logo.w, maxH / logo.h);
  const w = logo.w * k, h = logo.h * k;
  try { doc.addImage(logo.data, logo.fmt || 'PNG', x, y + (maxH - h) / 2, w, h); } catch { return 0; }
  return w;
}

/** Encabezado: logo + emisor a la izquierda, título del documento a la derecha. Devuelve la Y siguiente. */
export function header(doc, { emisor, estudio = {}, titulo, subtitulo = '', lineas = [] }, landscape = false) {
  const { m } = PAGE;
  const W = landscape ? PAGE.h : PAGE.w;
  const lw = drawLogo(doc, estudio.logo, m, 8);
  const x0 = m + (lw ? lw + 4 : 0);
  doc.setTextColor(...C.ink);
  doc.setFont('helvetica', 'bold').setFontSize(11.5);
  const tituloW = doc.getTextWidth(t(titulo)) + 6;
  let tam = 13;
  doc.setFontSize(tam);
  while (tam > 8 && doc.getTextWidth(t(emisor)) > W - m - x0 - tituloW) { tam -= 0.5; doc.setFontSize(tam); }
  doc.text(t(emisor), x0, 14);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...C.muted);
  const sub = [estudio.cuit && `CUIT: ${estudio.cuit}`, estudio.domicilio, estudio.matricula && `Matrícula: ${estudio.matricula}`].filter(Boolean);
  sub.forEach((s, i) => doc.text(t(s), x0, 18.5 + i * 3.6));
  doc.setTextColor(...C.ink).setFont('helvetica', 'bold').setFontSize(11.5).text(t(titulo), W - m, 14, { align: 'right' });
  let n = 0;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...C.muted);
  if (subtitulo) doc.text(t(subtitulo), W - m, 18.5 + 3.6 * n++, { align: 'right' });
  lineas.forEach((l) => doc.text(t(l), W - m, 18.5 + 3.6 * n++, { align: 'right' }));
  const y = Math.max(23, 18.5 + Math.max(sub.length, n) * 3.6 + 0.5, lw ? 24 : 0);
  doc.setDrawColor(...C.ink).setLineWidth(0.5).line(m, y, W - m, y);
  return y + 3;
}

/** Barra de sección numerada. Devuelve la Y donde sigue el contenido. */
export function section(doc, y, titulo, n) {
  const h = 3.2 + 1.4 * D.k;
  if (y > PAGE.h - PAGE.bottom - 14) { doc.addPage(); y = 16; }
  doc.setFillColor(...C.ink).rect(PAGE.m, y, PAGE.w - PAGE.m * 2, h, 'F');
  doc.setTextColor(...C.white).setFont('helvetica', 'bold').setFontSize(fs(7.6)).text(t(n ? `${n}. ${titulo}` : titulo), PAGE.m + 2, y + h * 0.72);
  doc.setTextColor(...C.ink);
  return y + h;
}

/** Gráfico de torta (dona) con polígonos: no depende de canvas ni de imágenes. */
export function pie(doc, cx, cy, r, slices) {
  const total = slices.reduce((a, s) => a + s.monto, 0);
  if (!(total > 0)) return;
  let a = -Math.PI / 2;
  slices.forEach((s) => {
    const sweep = (s.monto / total) * Math.PI * 2;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 45)));
    const pts = [[cx, cy]];
    for (let i = 0; i <= steps; i++) pts.push([cx + r * Math.cos(a + (sweep * i) / steps), cy + r * Math.sin(a + (sweep * i) / steps)]);
    a += sweep;
    const rel = [];
    for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
    doc.setFillColor(...s.color).setDrawColor(255, 255, 255).setLineWidth(0.25);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
  });
  doc.setFillColor(255, 255, 255).circle(cx, cy, r * 0.5, 'F');
}

/** Resumen del costo laboral por rubro: tabla + gráfico (barra formal, torta o ninguno según `costo.estilo`). */
export function resumenCosto(doc, y, costo) {
  const { m, w } = PAGE;
  const estilo = costo.estilo || 'barra';
  const alto = 10 + (costo.slices.length + 2) * 3.6 * D.k + (estilo === 'barra' ? 11 : 0);
  if (y + alto > PAGE.h - PAGE.bottom) { doc.addPage(); y = 16; }
  y = section(doc, y, 'RESUMEN DE LA COMPOSICIÓN DEL COSTO LABORAL TOTAL (por rubro)');
  const startY = y;
  const conTorta = estilo === 'torta';
  const tw = conTorta ? 142 : w - m * 2;
  const sw = estilo === 'ninguno' ? 0 : 3.5;
  const cols = conTorta ? [40, 27, 29, 29, 13.5] : [60 + (sw ? 0 : 3.5), 36, 38, 32, 12.5];
  const end = table(doc, {
    startY: y, margin: { left: m, right: w - m - tw }, tableWidth: tw,
    head: [[...(sw ? [''] : []), 'Rubro', 'Aporte del trabajador', 'Contribución del empleador', 'Total', '%']],
    body: costo.slices.map((s) => [...(sw ? [''] : []), t(s.label), s.aporte ? m$(s.aporte) : '', s.contribucion ? m$(s.contribucion) : '', m$(s.monto), `${s.pct.toFixed(1).replace('.', ',')}%`]),
    foot: [[...(sw ? [''] : []), 'COSTO LABORAL TOTAL', m$(costo.totalAportes), m$(costo.totalContribuciones), m$(costo.costoTotal), '100%']],
    columnStyles: Object.fromEntries([...(sw ? [[0, { cellWidth: sw, cellPadding: 0 }]] : []), ...cols.map((c, i) => [i + (sw ? 1 : 0), { cellWidth: c, ...(i > 0 ? { halign: 'right' } : {}) }])]),
    didParseCell: (d) => {
      const ci = d.column.index - (sw ? 1 : 0);
      if (ci >= 1 && d.section !== 'body') d.cell.styles.halign = 'right';
      if (sw && d.section === 'body' && d.column.index === 0) d.cell.styles.fillColor = costo.slices[d.row.index].color;
    },
  });
  if (conTorta) {
    const r = 14.5, cx = w - m - r - 3, cy = startY + Math.max(r + 3, (end - startY) / 2);
    pie(doc, cx, cy, r, costo.slices);
    doc.setFont('helvetica', 'normal').setFontSize(5.8).setTextColor(...C.muted).text('Costo laboral', cx, cy - 0.3, { align: 'center' }).text('total', cx, cy + 2.2, { align: 'center' });
    doc.setTextColor(...C.ink);
    return Math.max(end, cy + r + 1);
  }
  if (estilo === 'barra') {
    const total = costo.slices.reduce((a, s) => a + s.monto, 0);
    const by = end + 3.2 * D.k + 0.5, bh = 3.5 + 2.5 * D.k, bw = w - m * 2;
    doc.setFont('helvetica', 'normal').setFontSize(fs(6.2)).setTextColor(...C.muted).text('Distribución del costo laboral total', m, by - 0.8);
    let x = m;
    costo.slices.forEach((s) => {
      const sw2 = (s.monto / total) * bw;
      doc.setFillColor(...s.color).rect(x, by, sw2, bh, 'F');
      if (sw2 > 11) doc.setTextColor(...textoSobre(s.color)).setFont('helvetica', 'bold').setFontSize(fs(6.4)).text(`${s.pct.toFixed(1).replace('.', ',')}%`, x + sw2 / 2, by + bh * 0.68, { align: 'center' });
      x += sw2;
    });
    doc.setDrawColor(...C.ink).setLineWidth(0.25).rect(m, by, bw, bh);
    doc.setTextColor(...C.ink);
    return by + bh + 1;
  }
  return end + 1;
}

/** Cuadro de datos en 4 columnas (rótulo, valor, rótulo, valor). */
export function infoBox(doc, y, pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) rows.push([pairs[i][0], t(pairs[i][1] || '-'), pairs[i + 1]?.[0] ?? '', t(pairs[i + 1] ? pairs[i + 1][1] || '-' : '')]);
  return table(doc, {
    startY: y, body: rows,
    styles: { fontSize: fs(7.2), cellPadding: { top: pd(0.55), bottom: pd(0.55), left: 1.5, right: 1.5 } },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 33, textColor: C.muted, fillColor: C.soft }, 1: { cellWidth: 'auto' }, 2: { fontStyle: 'bold', cellWidth: 33, textColor: C.muted, fillColor: C.soft }, 3: { cellWidth: 'auto' } },
  });
}

/** Franja con el neto a cobrar. */
export function netoBar(doc, y, amount) {
  const { m, w } = PAGE;
  const bh = 6.2 + 2.8 * D.k;
  if (y + bh > PAGE.h - PAGE.bottom) { doc.addPage(); y = 18; }
  doc.setFillColor(...C.soft).rect(m, y, w - m * 2, bh, 'F');
  doc.setDrawColor(...C.ink).setLineWidth(0.4).rect(m, y, w - m * 2, bh);
  doc.setTextColor(...C.ink).setFont('helvetica', 'bold').setFontSize(fs(9.5)).text('NETO A COBRAR', m + 3, y + bh * 0.67);
  doc.setFontSize(fs(12)).text(m$(amount), w - m - 3, y + bh * 0.69, { align: 'right' });
  return y + bh;
}

export function paragraph(doc, y, { label, text, italic = false, size = 8.5, color = C.ink }) {
  const { m, w } = PAGE;
  const sz = fs(size);
  doc.setFontSize(sz).setFont('helvetica', italic ? 'italic' : 'normal');
  const lines = doc.splitTextToSize(t(text), w - m * 2);
  const alto = (label ? sz * 0.42 + 1 : 0) + lines.length * sz * 0.4 + 2;
  if (y + alto > PAGE.h - PAGE.bottom) { doc.addPage(); y = 18; }
  doc.setTextColor(...color);
  if (label) { doc.setFont('helvetica', 'bold').setFontSize(sz).text(t(label), m, y); y += sz * 0.42 + 1; }
  doc.setFont('helvetica', italic ? 'italic' : 'normal').setFontSize(sz).text(lines, m, y);
  doc.setTextColor(...C.ink);
  return y + lines.length * sz * 0.4 + 2.2 * D.k;
}

/** Líneas de firma. Si no entran en la hoja, pasan a una nueva (y el ajuste de densidad lo detecta). */
export function signatures(doc, y, left, right, sigs = {}) {
  const { m, w } = PAGE;
  const gap = 5 + 8 * D.k, extra = sigs.left || sigs.right ? 3 : 0;
  if (y + gap + 7 + extra > PAGE.h - PAGE.bottom) { doc.addPage(); y = 25; }
  y += gap;
  doc.setDrawColor(...C.ink).setLineWidth(0.3);
  const half = (w - m * 2 - 20) / 2;
  const xl = m + half / 2, xr = w - m - half / 2;
  doc.line(m, y, m + half, y).line(w - m - half, y, w - m, y);
  doc.setFont('helvetica', 'normal').setFontSize(fs(8)).setTextColor(...C.muted);
  doc.text(t(left), xl, y + 3.6, { align: 'center' }).text(t(right), xr, y + 3.6, { align: 'center' });
  for (const [s, cx] of [[sigs.left, xl], [sigs.right, xr]]) {
    if (!s) continue;
    if (s.img) {
      try {
        const mh = Math.min(13, gap - 0.5), mw = half * 0.7, k = Math.min(mw / (s.w || 1), mh / (s.h || 1)), iw = (s.w || 1) * k, ih = (s.h || 1) * k;
        doc.addImage(s.img, 'PNG', cx - iw / 2, y - ih - 0.3, iw, ih);
      } catch { /* sin imagen */ }
    }
  }
  doc.setTextColor(...C.ink);
  return y + 6 + extra;
}

/**
 * Contribuciones del empleador en DOS columnas (ahorra alto): la base de cálculo es común.
 * Devuelve la Y siguiente.
 */
export function tablaContribuciones(doc, y, costo, vacio = 'Sin contribuciones configuradas (ver Configuración)') {
  const { m, w } = PAGE;
  const items = costo.contribuciones;
  if (!items.length) return table(doc, { startY: y, body: [[vacio]] }) + 1.5;
  doc.setFont('helvetica', 'italic').setFontSize(fs(6.6)).setTextColor(...C.muted)
    .text(`Base de cálculo de las contribuciones: ${m$(items[0].base)}`, m, y + 2.4);
  doc.setTextColor(...C.ink);
  const top = y + 3.4, colW = (w - m * 2 - 4) / 2;
  const half = Math.ceil(items.length / 2);
  const side = (arr, left) => table(doc, {
    startY: top, margin: { left: left ? m : m + colW + 4, right: left ? w - m - colW : m }, tableWidth: colW,
    head: [['Concepto', '%', 'Importe']],
    body: arr.map((c) => [t(c.label), `${String(c.pct).replace('.', ',')}%`, m$(c.monto)]),
    columnStyles: { 0: { cellWidth: colW - 36 }, 1: { halign: 'right', cellWidth: 12 }, 2: { halign: 'right', cellWidth: 24 } },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right'; },
  });
  const e1 = side(items.slice(0, half), true);
  const e2 = items.length > half ? side(items.slice(half), false) : top;
  const yy = Math.max(e1, e2);
  return table(doc, {
    startY: yy, body: [['Subtotal contribuciones a cargo del empleador', m$(costo.totalContribuciones)]],
    bodyStyles: { fillColor: C.soft, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: w - m * 2 - 36 }, 1: { halign: 'right', cellWidth: 36 } },
  }) + 1.5;
}

/** Pie con aviso legal y numeración, en todas las páginas. */
export function footer(doc, texto, landscape = false, desde = 1) {
  const n = doc.getNumberOfPages();
  const W = landscape ? PAGE.h : PAGE.w, H = landscape ? PAGE.w : PAGE.h;
  for (let i = desde; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line).setLineWidth(0.2).line(PAGE.m, H - 14, W - PAGE.m, H - 14);
    doc.setFont('helvetica', 'normal').setFontSize(6.8).setTextColor(...C.muted);
    doc.text(doc.splitTextToSize(t(texto), W - PAGE.m * 2 - 28), PAGE.m, H - 10.5);
    doc.text(`Página ${i} de ${n}`, W - PAGE.m, H - 10.5, { align: 'right' });
  }
}

/** 'YYYY-MM-DD HH:MM' legible: dd/mm/aaaa HH:MM (hora local). */
export function fechaHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
