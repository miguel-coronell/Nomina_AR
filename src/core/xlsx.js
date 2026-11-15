/** Lectura/escritura de Excel con SheetJS, cargado bajo demanda desde cdnjs. */
import { loadScript } from './dom.js';

const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

async function lib() {
  if (!globalThis.XLSX) await loadScript(SRC);
  if (!globalThis.XLSX) throw new Error('No se pudo cargar el lector de Excel.');
  return globalThis.XLSX;
}

/** Lee la primera hoja de un .xlsx/.xls/.csv y devuelve filas como objetos {encabezado: valor}. */
export async function readFirstSheet(file) {
  const X = await lib();
  const wb = X.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return X.utils.sheet_to_json(ws, { defval: '', raw: true });
}

/** sheets: [{ name, aoa?: any[][], rows?: object[], widths?: number[] }] */
export async function downloadXLSX(filename, sheets) {
  const X = await lib();
  const wb = X.utils.book_new();
  for (const s of sheets) {
    const ws = s.aoa ? X.utils.aoa_to_sheet(s.aoa) : X.utils.json_to_sheet(s.rows || []);
    if (s.widths) ws['!cols'] = s.widths.map((wch) => ({ wch }));
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  X.writeFile(wb, filename);
}
