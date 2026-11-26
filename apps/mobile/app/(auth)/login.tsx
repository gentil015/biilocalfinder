import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
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
import { homeForRole } from '@/src/navigation/role-routes';
import { authApi } from '@/src/services/api/endpoints/auth';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { loginSchema } from '@/src/utils/validation';

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;
  const signIn = useAuthStore((state) => state.signIn);
  const activeExperience = useAppStore((state) => state.activeExperience);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const tokens = await authApi.login(values);
      await signIn(tokens);
      router.replace(homeForRole(useAuthStore.getState().user?.role, activeExperience));
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  };

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        back={false}
        large
        eyebrow="BII LocalFinder"
        title="Welcome back"
        subtitle="Sign in to find or manage trusted local services."
      />

      <Card variant="elevated">
        <View style={{ gap: theme.spacing.md }}>
          <FormInput
            label="Email"
            control={control}
            name="email"
            error={errors.email?.message}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <PasswordField
            label="Password"
            control={control}
            name="password"
            error={errors.password?.message}
            placeholder="Your password"
          />
          <Notice message={formError} tone="error" />
          <Link
            href="/forgot-password"
            style={[typography.small, { color: colors.primaryDark, alignSelf: 'flex-end' }]}
          >
            Forgot password?
          </Link>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label="Sign in"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push('/register')}
          disabled={isSubmitting}
          fullWidth
        />
      </View>
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
