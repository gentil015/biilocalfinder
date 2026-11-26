import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  type Control,
  type FieldPath,
  type FieldValues,
  useController,
  useForm,
} from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { FormInput } from '@/src/components/ui/FormInput';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl, type SegmentOption } from '@/src/components/ui/SegmentedControl';
import { CURRENT_TERMS_VERSION } from '@/src/constants/config';
import { postAuthRouteForRole } from '@/src/navigation/role-routes';
import { authApi } from '@/src/services/api/endpoints/auth';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { registerFormSchema } from '@/src/utils/validation';

type RegisterValues = z.infer<typeof registerFormSchema>;

const roleOptions: SegmentOption<'CLIENT' | 'PROVIDER'>[] = [
  { label: 'Customer', value: 'CLIENT' },
  { label: 'Provider', value: 'PROVIDER' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;
  const signIn = useAuthStore((state) => state.signIn);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'CLIENT',
      termsAccepted: false,
    },
  });
  const termsField = useController({ control, name: 'termsAccepted' });
  const roleField = useController({ control, name: 'role' });

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    try {
      const tokens = await authApi.register({
        ...values,
        phone: values.phone || undefined,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      await signIn(tokens);
      const role = useAuthStore.getState().user?.role;
      if (role === 'PROVIDER') await useAppStore.getState().setActiveExperience('provider');
      router.replace(postAuthRouteForRole(role));
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  };

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        back={false}
        large
        eyebrow="Get started"
        title="Create your account"
        subtitle="Join as a customer to hire professionals, or as a provider to grow your business."
      />

      <Card variant="elevated">
        <View style={{ gap: theme.spacing.md }}>
          <SegmentedControl
            options={roleOptions}
            value={roleField.field.value}
            onChange={roleField.field.onChange}
          />
          <FormInput label="First name" control={control} name="firstName" error={errors.firstName?.message} />
          <FormInput label="Last name" control={control} name="lastName" error={errors.lastName?.message} />
          <FormInput
            label="Email"
            control={control}
            name="email"
            error={errors.email?.message}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormInput
            label="Phone (optional)"
            control={control}
            name="phone"
            error={errors.phone?.message}
            keyboardType="phone-pad"
          />
          <PasswordField
            label="Password"
            control={control}
            name="password"
            error={errors.password?.message}
            hint="At least 8 characters"
          />
        </View>
      </Card>

      <Card variant="muted">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsField.field.value }}
          onPress={() => termsField.field.onChange(!termsField.field.value)}
          style={styles.terms}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: termsField.field.value ? colors.primary : colors.borderStrong,
                backgroundColor: termsField.field.value ? colors.primary : colors.surface,
              },
            ]}
          >
            {termsField.field.value ? <Check size={14} color={colors.textOnPrimary} /> : null}
          </View>
          <Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>
            I accept the BII LocalFinder Terms of Service (version {CURRENT_TERMS_VERSION}).
          </Text>
        </Pressable>
      </Card>
      <Notice message={errors.termsAccepted?.message ?? null} tone="warning" />
      <Notice message={formError} tone="error" />

      <View style={{ gap: theme.spacing.md }}>
        <Button
          label="Create account"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />
        <Link
          href="/login"
          style={[typography.small, { color: colors.primaryDark, textAlign: 'center' }]}
        >
          Already have an account? Sign in
        </Link>
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
  terms: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm - 2,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
  },
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: spacing.xxl },
  toggle: { position: 'absolute', right: spacing.xs, top: 30 },
});
