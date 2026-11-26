import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth.store';
import { useAppStore } from '@/src/stores/app.store';
import { homeForRole } from '@/src/navigation/role-routes';
import type { UserRole } from '@/src/types/api';

export function useRoleGuard(allowed: UserRole[]) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const activeExperience = useAppStore((state) => state.activeExperience);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const allowedKey = allowed.join('|');
  const authorized = status === 'authenticated' && Boolean(user) && allowed.includes(user!.role);

  useEffect(() => {
    if (status === 'anonymous') {
      const target = onboardingComplete ? '/login' : '/welcome';
      if (pathname !== target) router.replace(target);
      return;
    }
    if (status === 'authenticated' && user && !allowed.includes(user.role)) {
      const target = homeForRole(user.role, activeExperience);
      if (pathname !== target) router.replace(target);
    }
  }, [status, user, router, pathname, allowedKey, activeExperience, onboardingComplete]);

  return { ready: authorized, user: authorized ? user : null };
}
