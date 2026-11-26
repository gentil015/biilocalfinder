import { Stack } from 'expo-router';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';

export default function ProviderLayout() {
  const { ready } = useRoleGuard(['PROVIDER']);
  const reducedMotion = useReducedMotion();
  if (!ready) return <RoleGuardLoading label="Loading your workspace…" />;
  return <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade' }} />;
}
