import type { ActiveExperience } from '@/src/stores/app.store';
import type { UserRole } from '@/src/types/api';

export type HomeRoute = '/home' | '/provider';

export function postAuthRouteForRole(role: UserRole | undefined): HomeRoute {
  return role === 'PROVIDER' ? '/provider' : '/home';
}

export function homeForRole(role: UserRole | undefined, preferred?: ActiveExperience | null): HomeRoute {
  const experience = preferred ?? (role === 'PROVIDER' ? 'provider' : 'customer');
  if (experience === 'provider' && role === 'PROVIDER') return '/provider';
  return '/home';
}
