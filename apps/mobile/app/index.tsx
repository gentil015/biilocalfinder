import { Redirect } from 'expo-router';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { useAuthStore } from '@/src/stores/auth.store';
import { useAppStore } from '@/src/stores/app.store';
import { homeForRole } from '@/src/navigation/role-routes';

export default function Index() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const activeExperience = useAppStore((state) => state.activeExperience);

  if (status === 'loading') return <RoleGuardLoading label="Preparing BII LocalFinder…" />;

  if (status === 'authenticated') return <Redirect href={homeForRole(user?.role, activeExperience)} />;
  return <Redirect href={onboardingComplete ? '/login' : '/welcome'} />;
}
