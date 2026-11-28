import { Stack } from 'expo-router';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { useGuestGuard } from '@/src/hooks/useRoleGuard';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';

export default function AuthLayout() {
  const { ready } = useGuestGuard();
  const reducedMotion = useReducedMotion();
  if (!ready) return <RoleGuardLoading label="Opening your workspace…" />;
  return <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade' }} />;
}
