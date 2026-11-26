import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { FormInput } from '@/src/components/ui/FormInput';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { authApi } from '@/src/services/api/endpoints/auth';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { typography } from '@/src/theme/metrics';
import { forgotPasswordSchema } from '@/src/utils/validation';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        eyebrow="Account recovery"
        title="Reset your password"
        subtitle="We will email you a code if an account exists for that address."
      />

      {sent ? (
        <Card variant="elevated">
          <View style={{ gap: theme.spacing.md }}>
            <Notice message="If the account exists, a reset code has been sent. Check your email." tone="success" />
            <Button
              label="Back to sign in"
              variant="secondary"
              onPress={() => router.replace('/login')}
              fullWidth
            />
          </View>
        </Card>
      ) : (
        <Card variant="elevated">
          <View style={{ gap: theme.spacing.md }}>
            <FormInput
              label="Email"
              control={control}
              name="email"
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Notice message={error} tone="error" />
            <Button
              label="Send reset code"
              loading={isSubmitting}
              disabled={isSubmitting}
              onPress={handleSubmit(async (values) => {
                setError(null);
                try {
                  await authApi.requestPasswordReset(values.email);
                  setSent(true);
                } catch (caught) {
                  setError(toApiError(caught).message);
                }
              })}
              fullWidth
            />
            <Link
              href="/login"
              style={[typography.small, { color: colors.primaryDark, textAlign: 'center' }]}
            >
              Back to sign in
            </Link>
          </View>
        </Card>
      )}
    </Screen>
  );
}
