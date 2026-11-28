import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Bookmark, Download, Flag, Languages, Scale, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton, ProfileSkeleton } from '@/src/components/ui/Skeleton';
import { ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { toApiError } from '@/src/services/api/errors';
import { usersApi } from '@/src/services/api/endpoints/users';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import type { AuthUser } from '@/src/types/api';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'rw', label: 'Kinyarwanda' },
] as const;

const DELETE_PHRASE = 'DELETE';

export default function AccountScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const status = useAuthStore((state) => state.status);
  const storeUser = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const signOut = useAuthStore((state) => state.signOut);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const account = useQuery({ queryKey: ['account', 'me'], queryFn: () => usersApi.me() });

  const locale = useMutation({
    mutationFn: (code: string) => usersApi.updateLocale(code),
    onSuccess: async (user: AuthUser) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account', 'me'] }),
        refreshUser(),
      ]);
      setNotice({ message: `Language set to ${user.locale}.`, tone: 'success' });
      showToast(`Language set to ${user.locale}.`, 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const exportData = useMutation({
    mutationFn: () => usersApi.requestExport(),
    onSuccess: (data) => {
      setExportJson(JSON.stringify(data, null, 2) ?? 'null');
      setNotice({ message: 'Your data export is ready.', tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const removeAccount = useMutation({
    mutationFn: () => usersApi.deleteAccount(password),
    onSuccess: async () => {
      setDeleteOpen(false);
      setPassword('');
      setConfirmText('');
      await signOut();
      router.replace('/(auth)/login');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  if (status === 'loading' || account.isPending) {
    return (
      <Screen contentStyle={{ gap: spacing.lg }}>
        <AppScreenHeader title="Account" eyebrow="Settings" back />
        <ProfileSkeleton />
        <ListSkeleton rows={4} />
      </Screen>
    );
  }

  const user = account.data ?? storeUser;

  if (!ready) return <RoleGuardLoading />;

  const iconColor = colors.primaryDark;
  const canDelete = Boolean(password) && confirmText.trim().toUpperCase() === DELETE_PHRASE;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader title="Account" eyebrow="Settings" subtitle="Profile, preferences, and privacy" back />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      {account.isError ? (
        <ErrorState message="Your account could not be loaded." onRetry={() => void account.refetch()} />
      ) : !user ? (
        <ErrorState title="Sign in required" message="Sign in to see your account details." onRetry={() => router.push('/(auth)/login')} />
      ) : (
        <>
          <Card variant="elevated">
            <Text style={[typography.h3, { color: colors.text }]}>
              {user.firstName} {user.lastName}
            </Text>
            <Text style={[typography.small, { color: colors.textMuted }]}>{user.email}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Role: {user.role}</Text>
            <MenuRow
              icon={<UserRound size={18} color={iconColor} />}
              label="Edit profile"
              onPress={() =>
                router.push(
                  user.role === 'PROVIDER'
                    ? '/provider/profile'
                    : '/profile',
                )
              }
            />
            <MenuRow icon={<ShieldCheck size={18} color={iconColor} />} label="Verification" onPress={() => router.push('/verification')} />
          </Card>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Activity" subtitle="Your saved work and conversations." />
            <Card style={styles.menuGroup}>
              <MenuRow icon={<Bookmark size={18} color={iconColor} />} label="Saved searches" onPress={() => router.push('/saved-searches')} />
              <MenuRow icon={<Scale size={18} color={iconColor} />} label="Disputes" onPress={() => router.push('/disputes')} />
              <MenuRow icon={<Flag size={18} color={iconColor} />} label="My reports" onPress={() => router.push('/reports')} />
              <MenuRow icon={<Sparkles size={18} color={iconColor} />} label="Assistant" onPress={() => router.push('/assistant')} />
              <MenuRow icon={<Bell size={18} color={iconColor} />} label="Notifications" onPress={() => router.push('/notifications')} />
            </Card>
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Preferences" subtitle="Personalization and language." />
            <Card style={styles.menuGroup}>
              <MenuRow
                icon={<Sparkles size={18} color={iconColor} />}
                label="Personalization settings"
                onPress={() => router.push('/settings/personalization')}
              />
              <View style={styles.localeRow}>
                <View style={styles.localeTitle}>
                  <Languages size={18} color={iconColor} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>Language</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Changes save immediately.</Text>
                  </View>
                </View>
                <View style={styles.localeOptions}>
                  {LOCALES.map((option) => (
                    <Chip
                      key={option.code}
                      label={option.label}
                      selected={user.locale === option.code}
                      disabled={locale.isPending}
                      onPress={() => locale.mutate(option.code)}
                    />
                  ))}
                </View>
              </View>
            </Card>
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Privacy and data" subtitle="Your rights over the data we hold." />
            <Card>
              <Button
                label="Download my data"
                variant="secondary"
                icon={<Download size={16} color={iconColor} />}
                loading={exportData.isPending}
                onPress={() => exportData.mutate()}
                fullWidth
              />
              {exportJson ? (
                <View style={styles.export}>
                  <Notice message="Data ready. Copy the JSON below, or share it to save it on your device." tone="info" />
                  <ScrollView style={styles.jsonBox} nestedScrollEnabled>
                    <Text selectable style={[typography.caption, { color: colors.text }]}>{exportJson}</Text>
                  </ScrollView>
                  <Button
                    label="Share JSON"
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      void Share.share({ message: exportJson }).catch(() =>
                        setNotice({ message: 'Sharing is unavailable. Copy the JSON above instead.', tone: 'warning' }),
                      )
                    }
                  />
                </View>
              ) : null}
              <Button
                label="Delete account"
                variant="danger"
                icon={<Trash2 size={16} color={colors.white} />}
                onPress={() => {
                  setDeleteOpen(true);
                  setPassword('');
                  setConfirmText('');
                  setNotice(null);
                }}
                fullWidth
              />
              <Notice message="Deleting your account is permanent and cannot be undone." tone="warning" />
            </Card>
          </View>

          <Card>
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} fullWidth />
          </Card>
        </>
      )}

      <BottomSheet
        visible={deleteOpen}
        title="Delete account"
        onClose={() => {
          if (!removeAccount.isPending) setDeleteOpen(false);
        }}
        footer={
          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              disabled={removeAccount.isPending}
              onPress={() => {
                setDeleteOpen(false);
                setPassword('');
                setConfirmText('');
              }}
            />
            <Button
              label="Delete permanently"
              variant="danger"
              loading={removeAccount.isPending}
              disabled={!canDelete}
              onPress={() => removeAccount.mutate()}
            />
          </View>
        }
      >
        <Notice message="This cannot be undone. Confirm with your password and by typing DELETE." tone="warning" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        <Input
          label={`Type ${DELETE_PHRASE} to confirm`}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          placeholder={DELETE_PHRASE}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menuGroup: { gap: 0, paddingVertical: 4 },
  localeRow: { gap: 12, paddingTop: 8 },
  localeTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  localeOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  export: { gap: 12 },
  jsonBox: { maxHeight: 200, borderRadius: 12, borderWidth: 1, padding: 12 },
  actions: { flexDirection: 'row', gap: 8 },
});
