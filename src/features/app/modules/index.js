/**
 * REGISTRO DE MÓDULOS
 * ---------------------------------------------------------------
 * Para agregar una función nueva a la app:
 *   1. Creá una carpeta en features/app/modules/<nombre>/ con un index.js que exporte:
 *        export default { id, title, icon, group, mount(container, ctx, params) }
 *      (mount puede devolver una función de limpieza).
 *   2. Importalo y sumalo al array de abajo. El menú y las rutas se arman solos.
 */
import dashboard from './dashboard/index.js';
import employees from './employees/index.js';
import payroll from './payroll/index.js';
import simulator from './simulator/index.js';
import receipts from './receipts/index.js';
import history from './history/index.js';
import legal from './legal/index.js';
import settings from './settings/index.js';
import escalas from './escalas/index.js';

import payments from './payments/index.js';
import reports from './reports/index.js';

// Orden = orden del menú lateral
export const MODULES = [dashboard, employees, payroll, payments, reports, simulator, receipts, history, legal, escalas, settings];
