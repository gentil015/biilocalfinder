import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
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
import { SegmentedControl, type SegmentOption } from '@/src/components/ui/SegmentedControl';
import { postAuthRouteForRole } from '@/src/navigation/role-routes';
import { authApi } from '@/src/services/api/endpoints/auth';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { otpSchema } from '@/src/utils/validation';

type Values = z.infer<typeof otpSchema>;
type Channel = 'EMAIL' | 'PHONE';

const channels: SegmentOption<Channel>[] = [
  { label: 'Phone', value: 'PHONE' },
  { label: 'Email', value: 'EMAIL' },
];

export default function VerifyContactScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [channel, setChannel] = useState<Channel>('PHONE');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const finish = async () => {
    const role = useAuthStore.getState().user?.role;
    if (role === 'PROVIDER') await useAppStore.getState().setActiveExperience('provider');
    router.replace(postAuthRouteForRole(role));
  };

  const requestCode = async () => {
    if (sending) return;
    setSending(true);
    setMessage(null);
    try {
      await authApi.requestContactCode(channel);
      setCodeSent(true);
    } catch (error) {
      setMessage(toApiError(error).message);
    } finally {
      setSending(false);
    }
  };

  const confirm = async (values: Values) => {
    setMessage(null);
    try {
      await authApi.confirmContactCode(channel, values.code);
      await useAuthStore.getState().refreshUser();
      await finish();
    } catch (error) {
      setMessage(toApiError(error).message);
    }
  };

  return (
    <Screen contentStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}>
      <AppScreenHeader
        eyebrow="Trust & safety"
        title="Verify contact details"
        subtitle="A verified contact detail helps clients trust your profile. You can skip this and do it later."
      />

      <Card variant="elevated">
        <View style={{ gap: theme.spacing.md }}>
          <SegmentedControl
            options={channels}
            value={channel}
            onChange={(next) => {
              setChannel(next);
              setCodeSent(false);
            }}
          />
          <Button
            label={codeSent ? 'Resend code' : 'Send code'}
            variant="secondary"
              onPress={requestCode}
              loading={sending}
              disabled={sending}
              fullWidth
          />
          {codeSent ? (
            <View style={{ gap: theme.spacing.md }}>
              <FormInput
                label="6-digit code"
                control={control}
                name="code"
                error={errors.code?.message}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
              <Notice message={errors.code?.message ?? null} tone="warning" />
              <Button
                label="Verify"
                onPress={handleSubmit(confirm)}
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
              />
            </View>
          ) : null}
          <Notice message={message} tone="error" />
        </View>
      </Card>

      <Button
        label="Skip for now"
        variant="ghost"
        onPress={() => void finish()}
        fullWidth
      />
    </Screen>
  );
}
