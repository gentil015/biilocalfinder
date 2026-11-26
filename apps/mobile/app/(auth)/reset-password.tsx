import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { type Control, type FieldPath, type FieldValues, useController, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { FormInput } from '@/src/components/ui/FormInput';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { authApi } from '@/src/services/api/endpoints/auth';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';
import { resetPasswordSchema } from '@/src/utils/validation';

type Values = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.token ?? '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await authApi.resetPassword(values.token, values.newPassword);
      setDone(true);
      router.replace('/login');
    } catch (caught) {
      setError(toApiError(caught).message);
    }
  };

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        eyebrow="Account recovery"
        title="Choose a new password"
        subtitle={params.token ? 'Use a new password you have not used here before.' : undefined}
      />

      {done ? (
        <Notice message="Password updated. You can sign in now." tone="success" />
      ) : (
        <Card variant="elevated">
          <View style={{ gap: theme.spacing.md }}>
            <PasswordField
              label="New password"
              control={control}
              name="newPassword"
              error={errors.newPassword?.message}
              hint="At least 8 characters"
            />
            <PasswordField
              label="Confirm password"
              control={control}
              name="confirmPassword"
              error={errors.confirmPassword?.message}
            />
            <Notice message={errors.token?.message ?? null} tone="warning" />
            <Notice message={error} tone="error" />
            <Button
              label="Update password"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
              fullWidth
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}

function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  error,
  placeholder,
  hint,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  error?: string;
  placeholder?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const { field } = useController<T>({ control, name });
  return (
    <View style={styles.passwordField}>
      <Input
        label={label}
        value={String(field.value ?? '')}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        error={error}
        placeholder={placeholder}
        hint={hint}
        secureTextEntry={!visible}
        containerStyle={styles.passwordInput}
      />
      <View style={styles.toggle}>
        <IconButton
          icon={visible ? <EyeOff size={18} /> : <Eye size={18} />}
          label={visible ? 'Hide password' : 'Show password'}
          variant="ghost"
          size={theme.hit.compact}
          onPress={() => setVisible((current) => !current)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: spacing.xxl },
  toggle: { position: 'absolute', right: spacing.xs, top: 30 },
});
