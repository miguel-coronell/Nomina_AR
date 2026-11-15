const COL = 'liquidations';

/** Guarda solo lo necesario del resultado del motor (datos serializables y compactos). */
export const toRecord = (result, meta = {}) => ({
  employeeId: meta.employeeId || '',
  employeeName: meta.employeeName || result.input.nombre || 'Sin nombre',
  employeeDni: meta.employeeDni || '',
  employeeCuil: meta.employeeCuil || '',
  employeeLegajo: meta.employeeLegajo || '',
  convenio: meta.convenio || '',
  categoria: meta.categoria || '',
  notas: meta.notas || '',
  input: result.input,
  antiguedad: result.antiguedad,
  marco: result.marco,
  rubros: result.rubros,
  deducciones: result.deducciones,
  totals: result.totals,
  refs: result.refs,
  warnings: result.warnings,
  params: result.params || null,
  pago: meta.pago || null,
  deposito: meta.deposito || null,
});

export function createLiquidationsService(repo) {
  return {
    list: () => repo.list(COL),
    get: (id) => repo.get(COL, id),
    save: (result, meta) => repo.create(COL, toRecord(result, meta)),
    remove: (id) => repo.remove(COL, id),

    /** Métricas para el dashboard. */
    stats(items) {
      const totalNeto = items.reduce((a, l) => a + (l.totals?.neto || 0), 0);
      const meses = new Map();
      const base = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        meses.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, { label: d.toLocaleDateString('es-AR', { month: 'short' }), total: 0, count: 0 });
      }
      for (const l of items) {
        const k = String(l.createdAt || '').slice(0, 7);
        if (meses.has(k)) { const m = meses.get(k); m.total += l.totals?.neto || 0; m.count += 1; }
      }
      return { count: items.length, totalNeto, porMes: [...meses.values()] };
    },
  };
}
