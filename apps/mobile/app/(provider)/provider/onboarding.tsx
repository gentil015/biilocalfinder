import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Check, Circle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Avatar, Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { FormInput } from '@/src/components/ui/FormInput';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { ErrorState } from '@/src/components/ui/States';
import { queryKeys, useOfferings, useOnboarding, useProviderProfile, useVerification } from '@/src/hooks/queries';
import { filesApi } from '@/src/services/api/endpoints/files';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { humanize, statusLabel } from '@/src/utils/format';
import { providerOnboardingFormSchema } from '@/src/utils/validation';

type Values = z.infer<typeof providerOnboardingFormSchema>;
type NoticeState = { message: string; tone: NoticeTone } | null;

const providerTypes: Values['providerType'][] = ['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY'];

export default function ProviderOnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const onboarding = useOnboarding();
  const offerings = useOfferings();
  const verification = useVerification();
  const profile = useProviderProfile();
  const [logoUrl, setLogoUrl] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState('');
  const [pickingLogo, setPickingLogo] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const { control, handleSubmit, reset, watch } = useForm<Values>({
    resolver: zodResolver(providerOnboardingFormSchema),
    defaultValues: {
      providerType: 'INDIVIDUAL',
      businessName: '',
      bio: '',
      phone: '',
      registrationNumber: '',
      representativeName: '',
      teamSize: '',
    },
  });
  const providerType = watch('providerType');

  useEffect(() => {
    const data = onboarding.data;
    if (!data) return;
    reset({
      providerType: data.providerType ?? 'INDIVIDUAL',
      businessName: data.businessName ?? '',
      bio: data.bio ?? data.description ?? '',
      phone: data.phone ?? data.accountPhone ?? '',
      registrationNumber: data.registrationNumber ?? '',
      representativeName: data.representativeName ?? '',
      teamSize: data.teamSize ? String(data.teamSize) : '',
    });
    setLogoUrl(data.logoUrl ?? '');
  }, [onboarding.data, reset]);

  useEffect(() => {
    const radius = profile.data?.serviceRadiusKm;
    if (radius !== null && radius !== undefined) setServiceRadiusKm(String(radius));
  }, [profile.data?.serviceRadiusKm]);

  const pickLogo = async () => {
    setNotice(null);
    setPickingLogo(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const uploaded = await filesApi.uploadImage({
        uri: asset.uri,
        name: asset.fileName ?? asset.uri.split('/').pop() ?? 'logo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setLogoUrl(uploaded.url);
      setNotice({ message: 'Logo uploaded. Save your details to apply it.', tone: 'success' });
    } catch (error) {
      setNotice({ message: toApiError(error).message, tone: 'error' });
    } finally {
      setPickingLogo(false);
    }
  };

  const data = onboarding.data;
  const hasOffering = Boolean(data?.hasActiveOffering || offerings.data?.some((item) => item.isActive));
  const canComplete = Boolean(data?.location && hasOffering);
  const verificationStatus = String(verification.data?.status ?? 'UNVERIFIED');
  const showLegal = providerType === 'BUSINESS' || providerType === 'AGENCY';
  const showRepresentative = providerType === 'TEAM' || providerType === 'BUSINESS' || providerType === 'AGENCY';
  const showTeamSize = providerType === 'TEAM' || providerType === 'BUSINESS' || providerType === 'AGENCY';
  const checklist = [
    { label: 'Provider type', done: Boolean(data?.providerType) },
    { label: 'Business details', done: Boolean(data?.businessName && (data?.providerType === 'INDIVIDUAL' || data?.representativeName)) },
    { label: 'Service offering', done: hasOffering, onPress: () => router.push('/provider/services') },
    { label: 'Location', done: Boolean(data?.location), onPress: () => router.push('/location') },
    { label: 'Verification', done: verificationStatus === 'VERIFIED', onPress: () => router.push('/verification') },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const progressPercent = Math.round((doneCount / checklist.length) * 100);
  const progressWidth = `${progressPercent}%` as `${number}%`;
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    await queryClient.invalidateQueries({ queryKey: queryKeys.providerProfile });
  };

  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (values.providerType !== data?.providerType) await providerApi.setType(values.providerType);
      await providerApi.updateOnboardingProfile({
        businessName: values.businessName,
        bio: values.bio || undefined,
        phone: values.phone || undefined,
        registrationNumber: values.registrationNumber || undefined,
        representativeName: values.representativeName || undefined,
        teamSize: values.teamSize ? Number(values.teamSize) : undefined,
        logoUrl: logoUrl || undefined,
      });
      if (serviceRadiusKm.trim()) await providerApi.updateProfile({ serviceRadiusKm: Number(serviceRadiusKm) });
    },
    onSuccess: async () => {
      await invalidate();
      setNotice({ message: 'Onboarding details saved.', tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const complete = useMutation({
    mutationFn: () => providerApi.completeOnboarding(),
    onSuccess: async () => {
      await invalidate();
      setNotice({ message: 'Onboarding complete.', tone: 'success' });
      router.back();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const submitDetails = handleSubmit((values) => {
    if (serviceRadiusKm.trim()) {
      const radius = Number(serviceRadiusKm);
      if (!Number.isFinite(radius) || radius < 1 || radius > 200) {
        setNotice({ message: 'Service radius must be between 1 and 200 km.', tone: 'error' });
        return;
      }
    }
    save.mutate(values);
  });

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}>
      <AppScreenHeader
        eyebrow="Getting started"
        title="Provider onboarding"
        subtitle={`Step: ${humanize(data?.onboardingStep ?? 'TYPE_SELECTION')}`}
        action={data?.onboardingStep === 'COMPLETED' ? <Badge label="Complete" tone="success" /> : undefined}
      />

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
      {onboarding.isError ? <ErrorState message="Onboarding state could not be loaded." onRetry={() => void onboarding.refetch()} /> : null}
      {offerings.isError ? <Notice message="Service offerings could not be loaded." tone="error" /> : null}

      {onboarding.isLoading ? (
        <Card style={cardStyle}>
          <Skeleton width="55%" height={18} />
          <Skeleton height={10} />
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={44} />)}
        </Card>
      ) : (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Text style={[typography.h3, { color: colors.text }]}>Setup progress</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{doneCount} of {checklist.length} checks complete</Text>
              </View>
              <Text style={[typography.h2, { color: colors.primaryDark }]}>{progressPercent}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
              <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.primary, width: progressWidth }} />
            </View>
            <View style={{ gap: spacing.xs }}>
              {checklist.map((item) => (
                <ChecklistRow
                  key={item.label}
                  label={item.label}
                  done={item.done}
                  onPress={item.onPress}
                  caption={item.label === 'Verification' && !verification.isLoading ? statusLabel.verification(verificationStatus) : undefined}
                />
              ))}
            </View>
            {verification.isLoading ? <Skeleton width="60%" height={12} /> : null}
            {verification.isError ? <Notice message="Verification status could not be loaded." tone="error" /> : null}
            {!verification.isLoading && !verification.isError && verificationStatus !== 'VERIFIED' ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Verification is reviewed separately. Current status: {statusLabel.verification(verificationStatus)}.
              </Text>
            ) : null}
          </View>
        </Card>
      )}

      <Card style={cardStyle}>
        <SectionHeader title="Provider type & details" subtitle="Tell clients who you are" />
        <View style={{ gap: spacing.md }}>
          <Controller
            control={control}
            name="providerType"
            render={({ field }) => (
              <View style={{ gap: spacing.sm }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>Provider type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {providerTypes.map((type) => (
                    <Chip
                      key={type}
                      label={humanize(type)}
                      selected={field.value === type}
                      tone="neutral"
                      onPress={() => field.onChange(type)}
                    />
                  ))}
                </View>
              </View>
            )}
          />
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Logo</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar
                uri={logoUrl || data?.accountAvatarUrl}
                name={data?.businessName ?? 'Provider'}
                size={48}
              />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {logoUrl ? 'A new logo is ready to save.' : 'Upload a logo for your business profile.'}
                </Text>
                <Button
                  label="Choose logo"
                  variant="secondary"
                  size="sm"
                  loading={pickingLogo}
                  onPress={() => void pickLogo()}
                />
              </View>
            </View>
          </View>
          <Input
            label="Service radius (km)"
            value={serviceRadiusKm}
            onChangeText={setServiceRadiusKm}
            placeholder="e.g. 25"
            keyboardType="numeric"
            hint="Optional · distance you serve clients"
          />
          <FormInput label="Business or professional name" control={control} name="businessName" />
          <FormInput label="Bio" control={control} name="bio" multiline numberOfLines={4} />
          <FormInput label="Phone" control={control} name="phone" keyboardType="phone-pad" />
          {showLegal ? <FormInput label="Registration number" control={control} name="registrationNumber" /> : null}
          {showRepresentative ? <FormInput label="Representative name" control={control} name="representativeName" /> : null}
          {showTeamSize ? <FormInput label="Team size" control={control} name="teamSize" keyboardType="numeric" /> : null}
          <Button label="Save details" onPress={submitDetails} loading={save.isPending} />
        </View>
      </Card>

      <Button
        label="Complete onboarding"
        onPress={() => complete.mutate()}
        loading={complete.isPending}
        disabled={!canComplete || data?.onboardingStep === 'COMPLETED'}
      />
      {!canComplete ? (
        <Notice
          message="Add at least one active service offering and set your location before completing onboarding."
          tone="info"
        />
      ) : null}
    </Screen>
  );
}

function ChecklistRow({ label, done, onPress, caption }: { label: string; done: boolean; onPress?: () => void; caption?: string }) {
  const { colors, spacing, radius, typography, borderWidth, hit } = useTheme();
  const content: ReactNode = (
    <>
      {done ? <Check size={18} color={colors.success} /> : <Circle size={18} color={colors.textMuted} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.body, { color: done ? colors.textSecondary : colors.text, flex: 1 }]}>{label}</Text>
        {caption ? <Text style={[typography.caption, { color: colors.textMuted }]}>{caption}</Text> : null}
      </View>
      {onPress && !done ? <Text style={[typography.caption, { color: colors.primaryDark }]}>Open</Text> : null}
    </>
  );
  const style = [
    styles.row,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: borderWidth.thin,
      minHeight: hit.compact,
      padding: spacing.sm,
    },
  ];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
