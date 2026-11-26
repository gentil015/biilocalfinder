import { Stack } from 'expo-router';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';

export default function AuthLayout() {
  const reducedMotion = useReducedMotion();
  return <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'none' : 'fade' }} />;
}
