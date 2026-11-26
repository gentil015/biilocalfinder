import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Bookmark, Building2, FileText, Flag, Heart, LogOut, MapPin, Scale, Settings2, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Avatar, Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { FormInput } from '@/src/components/ui/FormInput';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton, ProfileSkeleton } from '@/src/components/ui/Skeleton';
import { ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { toApiError } from '@/src/services/api/errors';
import { clientsApi, usersApi } from '@/src/services/api/endpoints/users';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';
import { registerSchema } from '@/src/utils/validation';

const profileSchema = z.object({
  firstName: registerSchema.shape.firstName,
  lastName: registerSchema.shape.lastName,
  phone: z.string().trim().max(30).optional(),
  bio: z.string().max(1000).optional(),
});
type Values = z.infer<typeof profileSchema>;

function MenuSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={title} subtitle={subtitle} />
      <Card style={styles.menuGroup}>{children}</Card>
    </View>
  );
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors, typography } = useTheme();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const activeExperience = useAppStore((state) => state.activeExperience);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [editing, setEditing] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const profile = useQuery({ queryKey: ['client-profile'], queryFn: () => clientsApi.me() });
  const { control, handleSubmit, reset } = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '', bio: '' },
  });

  useEffect(() => {
    if (profile.data) {
      reset({
        firstName: profile.data.user.firstName,
        lastName: profile.data.user.lastName,
        phone: profile.data.user.phone ?? '',
        bio: profile.data.bio ?? '',
      });
    }
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: async (values: Values) => {
      await usersApi.updateMe({
        firstName: values.firstName,
        lastName: values.lastName,
        ...(values.phone ? { phone: values.phone } : {}),
      });
      return clientsApi.update({ bio: values.bio || undefined });
    },
    onSuccess: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: ['client-profile'] });
      setEditing(false);
      setNotice({ message: 'Profile updated.', tone: 'success' });
      showToast('Profile updated.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const switchExperience = async () => {
    const next = activeExperience === 'provider' ? 'customer' : 'provider';
    await useAppStore.getState().setActiveExperience(next);
    router.replace(next === 'provider' ? '/provider' : '/');
  };

  const confirmSignOut = async () => {
    setSignOutOpen(false);
    await signOut();
    showToast('Signed out.', 'success');
  };

  const iconColor = colors.primaryDark;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader title="Profile" eyebrow="Your account" back={false} />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      {profile.isError ? (
        <ErrorState message="Your profile could not be loaded." onRetry={() => void profile.refetch()} />
      ) : profile.isPending ? (
        <>
          <ProfileSkeleton />
          <ListSkeleton rows={5} />
        </>
      ) : (
        <>
          <Card variant="elevated" style={styles.profile}>
            <Avatar uri={user?.avatarUrl} name={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size={64} />
            <View style={styles.identity}>
              <View style={styles.badges}>
                <Badge label={user?.role ?? 'CLIENT'} tone="accent" />
                {user?.emailVerified ? <Badge label="Email verified" tone="success" /> : null}
              </View>
              <Text style={[typography.h2, { color: colors.text }]}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text style={[typography.small, { color: colors.textMuted }]}>{user?.email}</Text>
            </View>
          </Card>

          {editing ? (
            <Card>
              <View style={styles.form}>
                <FormInput label="First name" control={control} name="firstName" />
                <FormInput label="Last name" control={control} name="lastName" />
                <FormInput label="Phone" control={control} name="phone" keyboardType="phone-pad" />
                <FormInput label="Bio" control={control} name="bio" multiline numberOfLines={3} />
                <View style={styles.actions}>
                  <Button label="Save" onPress={handleSubmit((values) => save.mutate(values))} loading={save.isPending} />
                  <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
                </View>
              </View>
            </Card>
          ) : (
            <Button label="Edit profile" variant="secondary" icon={<UserRound size={16} color={iconColor} />} onPress={() => setEditing(true)} />
          )}

          <MenuSection title="Saved for later" subtitle="Pick up where you left off.">
            <MenuRow icon={<Heart size={18} color={iconColor} />} label="Favorites" onPress={() => router.push('/favorites')} />
            <MenuRow icon={<Bookmark size={18} color={iconColor} />} label="Saved searches" onPress={() => router.push('/saved-searches')} />
            <MenuRow icon={<Scale size={18} color={iconColor} />} label="Compare providers" onPress={() => router.push('/compare')} />
          </MenuSection>

          <MenuSection title="Support and safety" subtitle="Get help and manage what you send.">
            <MenuRow icon={<Sparkles size={18} color={iconColor} />} label="Ask BII Assistant" onPress={() => router.push('/assistant')} />
            <MenuRow icon={<FileText size={18} color={iconColor} />} label="Disputes" onPress={() => router.push('/disputes')} />
            <MenuRow icon={<Flag size={18} color={iconColor} />} label="My reports" onPress={() => router.push('/reports')} />
          </MenuSection>

          <MenuSection title="Preferences" subtitle="Account details and how we contact you.">
            <MenuRow icon={<Settings2 size={18} color={iconColor} />} label="Account & preferences" onPress={() => router.push('/account')} />
            <MenuRow icon={<Bell size={18} color={iconColor} />} label="Notification settings" value="Preferences" onPress={() => router.push('/notifications?tab=preferences')} />
            <MenuRow icon={<MapPin size={18} color={iconColor} />} label="Saved location" onPress={() => router.push('/location')} />
            <MenuRow icon={<ShieldCheck size={18} color={iconColor} />} label="Verify contact details" onPress={() => router.push('/verify-contact')} />
            {user?.role === 'CLIENT' ? (
              <MenuRow icon={<UserPlus size={18} color={iconColor} />} label="Become a provider" onPress={() => router.push('/become-provider')} />
            ) : null}
          </MenuSection>

          {user?.role === 'PROVIDER' ? (
            <MenuSection title="Experience">
              <MenuRow
                icon={<Building2 size={18} color={iconColor} />}
                label={activeExperience === 'provider' ? 'Switch to customer mode' : 'Switch to provider mode'}
                value={activeExperience === 'provider' ? 'Provider' : 'Customer'}
                onPress={() => void switchExperience()}
              />
            </MenuSection>
          ) : null}

          <Button
            label="Sign out"
            variant="secondary"
            icon={<LogOut size={16} color={iconColor} />}
            onPress={() => setSignOutOpen(true)}
            fullWidth
          />
        </>
      )}

      <ConfirmDialog
        visible={signOutOpen}
        title="Sign out?"
        message="You will need to sign in again to continue."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        destructive
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setSignOutOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  identity: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  form: { gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  menuGroup: { gap: 0, paddingVertical: 4 },
});
