/**
 * Arranque de la aplicación autenticada:
 * guard de sesión → repositorio → servicios → contexto → shell + router.
 */
import { $, $$, on } from '../../core/dom.js';
import { requireAuth } from '../../core/guard.js';
import { toast } from '../../core/ui/toast.js';
import { openModal, confirmDialog } from '../../core/ui/modal.js';
import { bus, EVENTS } from '../../core/events.js';
import { ROUTES } from '../../config/app.config.js';
import { planOf } from '../../config/plans.config.js';
import { signOut } from '../../services/auth.service.js';
import { createRepository } from '../../data/repository.js';
import { createProfileService } from '../../services/profile.service.js';
import { createEmployeesService } from '../../services/employees.service.js';
import { createLiquidationsService } from '../../services/liquidations.service.js';
import { createPayrollService } from '../../services/payroll.service.js';
import { createSettingsService } from '../../services/settings.service.js';
import { MODULES } from './modules/index.js';
import { createRouter } from './shell/router.js';
import { shellView } from './shell/shell.view.js';

async function boot() {
  const user = await requireAuth();
  const repo = createRepository(user);

  const services = {
    profile: createProfileService(repo, user),
    employees: createEmployeesService(repo),
    liquidations: createLiquidationsService(repo),
    payroll: createPayrollService(repo),
    settings: createSettingsService(repo),
    repo,
  };

  const [profile, settings] = await Promise.all([services.profile.ensure(), services.settings.get()]);

  /** Contexto compartido con todos los módulos. */
  const ctx = {
    user,
    services,
    state: { profile, settings },
    get plan() { return planOf(this.state.profile?.plan); },
    toast, openModal, confirmDialog, bus,
    navigate: (path) => router.go(path),
    async updateSettings(next) {
      this.state.settings = await services.settings.save(next);
      bus.emit(EVENTS.settingsChanged, this.state.settings);
      return this.state.settings;
    },
  };

  const app = $('#app');
  app.innerHTML = shellView({ modules: MODULES, user, plan: ctx.plan });
  app.hidden = false;
  $('#boot').remove();

  const shell = $('#shell');
  const router = createRouter({
    modules: MODULES,
    container: $('#view'),
    ctx,
    onChange(mod) {
      $$('[data-nav]', shell).forEach((a) => a.classList.toggle('active', a.dataset.nav === mod.id));
      $('#page-title').textContent = mod.title;
      document.title = `${mod.title} | ArgenLiquid PRO`;
      shell.classList.remove('nav-open');
    },
  });

  on(shell, 'click', '[data-action]', async (e, el) => {
    const a = el.dataset.action;
    if (a === 'open-nav') shell.classList.add('nav-open');
    if (a === 'close-nav') shell.classList.remove('nav-open');
    if (a === 'logout') {
      if (await confirmDialog({ title: 'Cerrar sesión', message: '¿Querés salir de tu cuenta?', confirmText: 'Cerrar sesión' })) {
        await signOut();
        location.replace(ROUTES.login);
      }
    }
  });

  bus.on(EVENTS.settingsChanged, () => { $('#plan-badge').textContent = ctx.plan.name; });
  await router.start();
}

boot().catch((err) => {
  console.error(err);
  const boot = $('#boot');
  if (boot) boot.innerHTML = '<div><p style="max-width:26rem;margin:auto">No pudimos iniciar la aplicación. Revisá tu conexión y la configuración de Firebase, y recargá la página.</p><button class="btn btn-primary" style="margin-top:1rem" onclick="location.reload()">Reintentar</button></div>';
});
