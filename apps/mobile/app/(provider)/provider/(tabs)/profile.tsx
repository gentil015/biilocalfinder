import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Images,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Star,
  UserRound,
  Wrench,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Avatar, Badge, VerificationBadge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { FormInput } from '@/src/components/ui/FormInput';
import { IconButton } from '@/src/components/ui/IconButton';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ProfileSkeleton } from '@/src/components/ui/Skeleton';
import { ErrorState, LoadingState } from '@/src/components/ui/States';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { queryKeys, useAuthWorkspaces, useProviderProfile } from '@/src/hooks/queries';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { humanize, statusLabel } from '@/src/utils/format';
import { providerProfileFormSchema } from '@/src/utils/validation';
import type { VerificationStatus } from '@/src/types/api';

type Values = z.infer<typeof providerProfileFormSchema>;

export default function ProviderProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const workspaces = useAuthWorkspaces();
  const activeWorkspaceId = useAppStore((state) => state.activeWorkspaceId);
  const profile = useProviderProfile();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(providerProfileFormSchema),
    defaultValues: { businessName: '', description: '', phone: '', yearsOfExperience: '', serviceRadiusKm: '' },
  });

  useEffect(() => {
    if (profile.data) {
      reset({
        businessName: profile.data.businessName ?? '',
        description: profile.data.description ?? profile.data.bio ?? '',
        phone: user?.phone ?? '',
        yearsOfExperience: profile.data.yearsOfExperience ? String(profile.data.yearsOfExperience) : '',
        serviceRadiusKm: '',
      });
    }
  }, [profile.data, reset, user?.phone]);

  const save = useMutation({
    mutationFn: (values: Values) =>
      providerApi.updateProfile({
        businessName: values.businessName,
        description: values.description || undefined,
        phone: values.phone || undefined,
        yearsOfExperience:
          values.yearsOfExperience === '' || values.yearsOfExperience === undefined
            ? undefined
            : Number(values.yearsOfExperience),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.providerProfile }),
        useAuthStore.getState().refreshUser(),
      ]);
      setEditing(false);
      setNotice('Profile updated.');
      setNoticeTone('success');
    },
    onError: (error) => {
      setNotice(toApiError(error).message);
      setNoticeTone('error');
    },
  });

  const verificationStatus: VerificationStatus = profile.data?.verificationStatus ?? 'UNVERIFIED';
  const subscriptionStatus = profile.data?.subscriptionStatus;
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}>
      <AppScreenHeader
        eyebrow="Provider workspace"
        title="Profile"
        subtitle="Your business details and account settings"
        back={false}
        large
        action={
          <IconButton
            icon={<RefreshCw size={19} />}
            label="Refresh profile"
            size={hit.min}
            disabled={profile.isFetching}
            onPress={() => void Promise.all([profile.refetch(), workspaces.refetch()])}
          />
        }
      />

      {notice ? <Notice message={notice} tone={noticeTone} /> : null}

      {profile.isError ? (
        <ErrorState message="Profile could not be loaded." onRetry={() => void profile.refetch()} />
      ) : profile.isLoading ? (
        <ProfileSkeleton />
      ) : (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={profile.data?.avatarUrl} name={profile.data?.businessName ?? user?.firstName ?? 'Provider'} size={60} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[typography.h2, { color: colors.text }]}>{profile.data?.businessName ?? 'Your business'}</Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>{user?.email}</Text>
              <VerificationBadge status={verificationStatus} />
            </View>
          </View>
          {profile.data?.description || profile.data?.bio ? (
            <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={3}>
              {profile.data.description ?? profile.data.bio}
            </Text>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>No business description added yet.</Text>
          )}
        </Card>
      )}

      {workspaces.data && workspaces.data.length > 1 ? (
        <Card style={cardStyle}>
          <SectionHeader title="Active workspace" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {workspaces.data.map((workspace) => {
              const active = workspace.id === activeWorkspaceId;
              return (
                <Pressable
                  key={workspace.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => void useAuthStore.getState().selectWorkspace(workspace.id)}
                  style={{
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: radius.pill,
                    borderWidth: borderWidth.thin,
                    minHeight: hit.min,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Text style={[typography.caption, { color: active ? colors.textOnPrimary : colors.text }]}>{workspace.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      ) : null}

      <Card style={cardStyle}>
        <SectionHeader title="Subscription" />
        {profile.isLoading ? (
          <LoadingState label="Loading subscription status…" />
        ) : profile.isError ? (
          <Notice message="Subscription status could not be loaded." tone="error" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <CreditCard size={18} color={colors.primaryDark} />
              <Badge label={humanize(subscriptionStatus ?? 'INACTIVE')} tone={subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING' ? 'success' : 'neutral'} />
            </View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Status: {humanize(subscriptionStatus ?? 'INACTIVE')}. Billing and plan changes are temporarily unavailable while the backend payment module is being repaired.
            </Text>
          </View>
        )}
      </Card>

      {editing ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <SectionHeader title="Edit business profile" />
          <View style={{ gap: spacing.md }}>
            <FormInput label="Business name" control={control} name="businessName" />
            <FormInput label="Description" control={control} name="description" multiline numberOfLines={4} />
            <FormInput label="Phone" control={control} name="phone" keyboardType="phone-pad" />
            <FormInput label="Years of experience" control={control} name="yearsOfExperience" keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Save" onPress={handleSubmit((values) => save.mutate(values))} loading={save.isPending} />
              <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
            </View>
          </View>
        </Card>
      ) : (
        <Button label="Edit business profile" variant="secondary" onPress={() => setEditing(true)} />
      )}

      <Card style={cardStyle}>
        <SectionHeader title="Business setup" />
        <View style={{ gap: spacing.xs }}>
          <MenuRow icon={<ClipboardList size={18} color={colors.primaryDark} />} label={profile.data?.onboardingStep === 'COMPLETED' ? 'Onboarding complete' : 'Continue onboarding'} value={profile.data?.onboardingStep ? humanize(profile.data.onboardingStep) : undefined} onPress={() => router.push('/provider/onboarding')} />
          <MenuRow icon={<Wrench size={18} color={colors.primaryDark} />} label="Services" onPress={() => router.push('/provider/services')} />
          <MenuRow icon={<BarChart3 size={18} color={colors.primaryDark} />} label="Insights & profile strength" onPress={() => router.push('/provider/insights')} />
          <MenuRow icon={<MapPin size={18} color={colors.primaryDark} />} label="Service areas" onPress={() => router.push('/provider/service-areas')} />
          <MenuRow icon={<Images size={18} color={colors.primaryDark} />} label="Portfolio" onPress={() => router.push('/provider/portfolio')} />
          <MenuRow icon={<Briefcase size={18} color={colors.primaryDark} />} label="Experience" onPress={() => router.push('/provider/experience')} />
          <MenuRow icon={<GraduationCap size={18} color={colors.primaryDark} />} label="Education" onPress={() => router.push('/provider/education')} />
        </View>
      </Card>

      <Card style={cardStyle}>
        <SectionHeader title="Trust & availability" />
        <View style={{ gap: spacing.xs }}>
          <MenuRow icon={<ShieldCheck size={18} color={colors.primaryDark} />} label="Verification" value={statusLabel.verification(verificationStatus)} onPress={() => router.push('/verification')} />
          <MenuRow icon={<CalendarClock size={18} color={colors.primaryDark} />} label="Availability & hours" onPress={() => router.push('/availability')} />
          <MenuRow icon={<Star size={18} color={colors.primaryDark} />} label="Reviews & responses" onPress={() => router.push('/reviews')} />
        </View>
      </Card>

      <Card style={cardStyle}>
        <SectionHeader title="Account" />
        <View style={{ gap: spacing.xs }}>
          <MenuRow icon={<Building2 size={18} color={colors.primaryDark} />} label="Workspaces" onPress={() => router.push('/workspaces')} />
          <MenuRow icon={<UserRound size={18} color={colors.primaryDark} />} label="Switch to customer mode" onPress={async () => { await useAppStore.getState().setActiveExperience('customer'); router.replace('/home'); }} />
        </View>
      </Card>

      <Button label="Sign out" variant="danger" icon={<LogOut size={16} />} onPress={() => setConfirmSignOut(true)} fullWidth />
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You will need to sign in again to access your provider workspace."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </Screen>
  );
}
