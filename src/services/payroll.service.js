import { armarRun, recalcRun, recalcLinea, nuevaLinea, totalesRun, estadoTrasPagos, periodoDeRun, paramsDe } from '../domain/payroll/run.js';
import { describirPeriodo, elegible, incluirEn } from '../domain/payroll/periodos.js';
import { snapshotEmpleado, normalizarNovedades } from '../domain/payroll/engine.js';

const COL = 'payrolls';
const err = (code, message) => Object.assign(new Error(message || code), { code });

export function createPayrollService(repo) {
  const persist = async (run) => {
    const patch = { lines: run.lines, totals: run.totals, estado: run.estado, params: run.params, fechaPago: run.fechaPago || '', notas: run.notas || '', lugarPago: run.lugarPago || '', deposito: run.deposito || null };
    await repo.update(COL, run.id, patch);
    return run;
  };
  const withTotals = (run) => ({ ...run, totals: totalesRun(run.lines), estado: estadoTrasPagos(run) });
  const editable = (run) => { if (run.estado !== 'borrador') throw err('LOCKED', 'La nómina está liquidada. Reabrila para modificarla.'); };

  return {
    list: () => repo.list(COL),
    get: (id) => repo.get(COL, id),
    remove: (id) => repo.remove(COL, id),

    /** Cantidad de empleados que entrarían en una nómina (para la vista previa del alta). */
    candidatos(cfg, employees) {
      const p = describirPeriodo(cfg);
      return employees.filter((e) => (cfg.todos || incluirEn(e, p.tipo)) && elegible(e, p));
    },

    /** `complementaria`: permite una segunda nómina del mismo período (ajustes, pagos adicionales). */
    async create(cfg, employees, settings, { complementaria = false } = {}) {
      let run = armarRun(cfg, employees, settings);
      if (!run.lines.length) throw err('EMPTY', 'No hay empleados para este período.');
      const mismas = (await repo.list(COL)).filter((r) => r.clave === run.clave || r.clave.startsWith(`${run.clave}-C`));
      if (mismas.length && !complementaria) throw Object.assign(err('DUPLICATE', `Ya existe una nómina para ${run.label}.`), { existingId: mismas[mismas.length - 1].id, label: run.label });
      if (mismas.length) { run.clave = `${run.clave}-C${mismas.length}`; run.label = `${run.label} (complementaria ${mismas.length})`; }
      return repo.create(COL, run);
    },

    async saveNovedades(run, employeeId, novedades) {
      editable(run);
      const periodo = periodoDeRun(run);
      const lines = run.lines.map((l) => (l.employeeId === employeeId ? recalcLinea({ ...l, novedades: normalizarNovedades(novedades) }, periodo, run.params) : l));
      return persist(withTotals({ ...run, lines }));
    },

    /** Vuelve a leer las fichas: actualiza datos, suma altas elegibles y quita bajas (solo borrador). */
    async refresh(run, employees, settings) {
      editable(run);
      const periodo = periodoDeRun(run), params = paramsDe(settings);
      const cur = new Map(run.lines.map((l) => [l.employeeId, l]));
      const lines = employees.filter((e) => incluirEn(e, periodo.tipo) && elegible(e, periodo)).map((e) => {
        const prev = cur.get(e.id);
        if (!prev) return nuevaLinea(e, periodo, params);
        return recalcLinea({ ...prev, nombre: e.nombre, dni: e.dni || '', cuil: e.cuil || '', legajo: e.legajo || '', categoria: e.categoria || '', banco: e.banco || '', cbu: e.cbu || '', snap: snapshotEmpleado(e) }, periodo, params);
      }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return persist(withTotals({ ...run, params, lines }));
    },

    async removeLine(run, employeeId) {
      editable(run);
      return persist(withTotals({ ...run, lines: run.lines.filter((l) => l.employeeId !== employeeId) }));
    },

    async setMeta(run, { fechaPago, notas, lugarPago, deposito }) {
      return persist({ ...run, fechaPago: fechaPago ?? run.fechaPago, notas: notas ?? run.notas, lugarPago: lugarPago ?? run.lugarPago, deposito: deposito ?? run.deposito });
    },

    async cerrar(run, settings) {
      editable(run);
      if (!run.lines.length) throw err('EMPTY', 'La nómina no tiene empleados.');
      const calc = recalcRun(run, settings);
      return persist(withTotals({ ...calc, estado: 'liquidada' }));
    },

    async reabrir(run) {
      if (run.lines.some((l) => l.pago.estado === 'pagado')) throw err('PAID', 'Hay pagos registrados. Revertilos antes de reabrir.');
      return persist({ ...run, estado: 'borrador' });
    },

    async registrarPago(run, employeeIds, { fecha, medio }) {
      if (run.estado === 'borrador') throw err('DRAFT', 'Liquidá la nómina antes de registrar pagos.');
      const ids = new Set(employeeIds);
      const lines = run.lines.map((l) => (ids.has(l.employeeId) ? { ...l, pago: { estado: 'pagado', fecha, medio } } : l));
      return persist(withTotals({ ...run, lines }));
    },

    async revertirPago(run, employeeIds) {
      const ids = new Set(employeeIds);
      const lines = run.lines.map((l) => (ids.has(l.employeeId) ? { ...l, pago: { estado: 'pendiente', fecha: '', medio: '' } } : l));
      return persist(withTotals({ ...run, lines }));
    },
  };
}
