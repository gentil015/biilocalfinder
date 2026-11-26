import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { authApi } from '@/src/services/api/endpoints/auth';
import { isGoogleSignInAvailable, signInWithGoogle } from '@/src/services/auth/google';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { postAuthRouteForRole } from '@/src/navigation/role-routes';
import { CURRENT_TERMS_VERSION } from '@/src/constants/config';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { useRouter } from 'expo-router';

export function GoogleAuthButton({
  mode,
  role = 'CLIENT',
  termsAccepted = false,
  onError,
}: {
  mode: 'login' | 'register';
  role?: 'CLIENT' | 'PROVIDER';
  termsAccepted?: boolean;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const [loading, setLoading] = useState(false);

  if (!isGoogleSignInAvailable()) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text style={[typography.caption, { color: colors.textMuted }]}>or continue with</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Button
        label="Continue with Google"
        variant="secondary"
        loading={loading}
        disabled={loading}
        fullWidth
        onPress={async () => {
          if (mode === 'register' && !termsAccepted) {
            onError?.('Accept the Terms and Conditions to create an account with Google.');
            return;
          }
          setLoading(true);
          try {
            const idToken = await signInWithGoogle();
            if (!idToken) return; // cancelled
            const tokens = await authApi.google({
              idToken,
              ...(mode === 'register'
                ? { role, termsAccepted: true as const, termsVersion: CURRENT_TERMS_VERSION }
                : {}),
            });
            await signIn(tokens);
            const currentRole = useAuthStore.getState().user?.role;
            if (currentRole === 'PROVIDER') await useAppStore.getState().setActiveExperience('provider');
            router.replace(postAuthRouteForRole(currentRole));
          } catch (error) {
            onError?.(toApiError(error).message);
          } finally {
            setLoading(false);
          }
        }}
      />
    </View>
  );
}
