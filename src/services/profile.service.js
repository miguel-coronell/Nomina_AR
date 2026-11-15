import { planOf } from '../config/plans.config.js';

/** Perfil del usuario (documento raíz users/{uid}) y su plan. */
export function createProfileService(repo, user) {
  return {
    /** Crea el perfil en el primer ingreso y registra el último acceso. */
    async ensure() {
      const existing = await repo.getRoot();
      const base = { displayName: user.name, email: user.email, photoURL: user.photoURL, lastLoginAt: new Date().toISOString() };
      if (!existing) {
        const profile = { ...base, plan: 'free', createdAt: new Date().toISOString() };
        await repo.setRoot(profile);
        return profile;
      }
      const merged = { ...existing, ...base };
      await repo.setRoot({ ...base }); // merge: no toca el plan
      return merged;
    },
    async get() { return (await repo.getRoot()) || { plan: 'free' }; },
    plan(profile) { return planOf(profile?.plan); },
  };
}
