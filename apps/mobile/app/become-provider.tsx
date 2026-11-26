import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock, ShieldCheck } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SearchBar } from '@/src/components/ui/SearchBar';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { useCategories } from '@/src/hooks/queries';
import {
  parityProviderApi,
  type ParityProviderType,
} from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useAuthStore } from '@/src/stores/auth.store';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { Category } from '@/src/types/api';
import { formatDate, humanize } from '@/src/utils/format';

const APPLICATIONS_KEY = ['provider-applications', 'mine'] as const;
const PROVIDER_TYPES: ParityProviderType[] = ['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY'];
const STEPS = ['About you', 'Contact and experience', 'Services'];

interface ApplicationForm {
  providerType: ParityProviderType;
  businessName: string;
  description: string;
  phone: string;
  yearsOfExperience: string;
  registrationNumber: string;
  idNumber: string;
  websiteUrl: string;
}

interface LeafCategory {
  slug: string;
  name: string;
  group: string;
}

const EMPTY_FORM: ApplicationForm = {
  providerType: 'INDIVIDUAL',
  businessName: '',
  description: '',
  phone: '',
  yearsOfExperience: '',
  registrationNumber: '',
  idNumber: '',
  websiteUrl: '',
};

function leafCategories(nodes: Category[], parentName?: string): LeafCategory[] {
  const result: LeafCategory[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    if (children.length === 0) {
      if (node.slug) result.push({ slug: node.slug, name: node.name, group: parentName ?? 'Other' });
    } else {
      result.push(...leafCategories(children, node.name));
    }
  }
  return result;
}

export default function BecomeProviderScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const applications = useQuery({
    queryKey: APPLICATIONS_KEY,
    queryFn: () => parityProviderApi.myApplications(),
    enabled: status === 'authenticated',
  });
  const categories = useCategories();
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);

  useEffect(() => {
    if (status === 'anonymous' && pathname !== '/login') router.replace('/login');
    if (user?.role === 'PROVIDER' && pathname !== '/provider') router.replace('/provider');
    if (user?.role === 'ADMIN' && pathname !== '/home') router.replace('/home');
  }, [status, user?.role, pathname, router]);

  useEffect(() => {
    if (!user || form.businessName) return;
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (name) setForm((current) => ({ ...current, businessName: name }));
  }, [user, form.businessName]);

  const submit = useMutation({
    mutationFn: () => {
      const years = form.yearsOfExperience.trim();
      return parityProviderApi.submitApplication({
        providerType: form.providerType,
        businessName: form.businessName.trim(),
        description: form.description.trim() || undefined,
        phone: form.phone.trim() || undefined,
        yearsOfExperience: years ? Number(years) : undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        websiteUrl: form.websiteUrl.trim() || undefined,
        categories: selectedCategories,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
      setNotice(null);
      showToast('Application submitted.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const update = <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleCategory = (slug: string) => {
    setSelectedCategories((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(0, 12),
    );
  };

  const yearsValid = () => {
    const years = form.yearsOfExperience.trim();
    return !years || (Number.isInteger(Number(years)) && Number(years) >= 0 && Number(years) <= 60);
  };

  const continueToNext = () => {
    if (step === 0 && form.businessName.trim().length < 2) {
      setNotice({ message: 'Enter the name clients will see.', tone: 'warning' });
      return;
    }
    if (step === 1 && !yearsValid()) {
      setNotice({ message: 'Years of experience must be between 0 and 60.', tone: 'warning' });
      return;
    }
    setNotice(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const onSubmit = () => {
    if (form.businessName.trim().length < 2) {
      setNotice({ message: 'Enter the name clients will see.', tone: 'warning' });
      setStep(0);
      return;
    }
    if (!yearsValid()) {
      setNotice({ message: 'Years of experience must be between 0 and 60.', tone: 'warning' });
      setStep(1);
      return;
    }
    setNotice(null);
    submit.mutate();
  };

  const leaves = useMemo(() => leafCategories(categories.data ?? []), [categories.data]);
  const grouped = useMemo(() => {
    const needle = categoryQuery.trim().toLowerCase();
    const groups = new Map<string, LeafCategory[]>();
    for (const category of leaves) {
      if (needle && !`${category.name} ${category.group}`.toLowerCase().includes(needle)) continue;
      const list = groups.get(category.group) ?? [];
      list.push(category);
      groups.set(category.group, list);
    }
    return Array.from(groups.entries());
  }, [leaves, categoryQuery]);

  const pending = applications.data?.find((application) => application.status === 'PENDING');
  const decided = applications.data?.filter((application) => application.status !== 'PENDING') ?? [];
  const needsLegal = form.providerType === 'BUSINESS' || form.providerType === 'AGENCY';

  if (status === 'loading') {
    return (
      <Screen contentStyle={{ gap: spacing.lg }}>
        <Skeleton width="60%" height={28} />
        <Skeleton height={16} />
        <Skeleton height={120} />
      </Screen>
    );
  }

  if (status === 'anonymous' || user?.role !== 'CLIENT') {
    return (
      <Screen contentStyle={{ gap: spacing.lg }}>
        <EmptyState title="Checking your account" message="Redirecting you to the right place…" />
      </Screen>
    );
  }

  if (!ready) return <RoleGuardLoading label="Loading provider application…" />;

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      refreshControl={
        <RefreshControl refreshing={applications.isFetching} onRefresh={() => void applications.refetch()} />
      }
    >
      <AppScreenHeader
        back={false}
        large
        eyebrow="Provider application"
        title="Become a provider"
        subtitle="Tell us what you do. An admin reviews every application before your account is upgraded."
      />

      {applications.isPending ? (
        <Card variant="muted">
          <Skeleton height={18} />
          <Skeleton width="70%" height={12} />
        </Card>
      ) : null}
      {applications.isError ? (
        <ErrorState
          title="Applications unavailable"
          message={toApiError(applications.error).message}
          onRetry={() => void applications.refetch()}
        />
      ) : null}
      {applications.isSuccess && applications.data.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={24} color={colors.primaryDark} />}
          title="No applications yet"
          message="Complete the form below to apply. You keep your login and request history."
        />
      ) : null}

      {pending ? (
        <Card variant="elevated">
          <View style={styles.row}>
            <Clock size={20} color={colors.primaryDark} />
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {pending.businessName} — under review
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Applied as {humanize(pending.providerType)} · {formatDate(pending.createdAt)}
              </Text>
              {pending.decisionNote ? (
                <Text style={[typography.small, { color: colors.textSecondary }]}>Note: {pending.decisionNote}</Text>
              ) : null}
            </View>
            <Badge label="Pending" tone="warning" />
          </View>
        </Card>
      ) : null}

      {decided.length ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader title="Previous applications" />
          {decided.map((application) => (
            <Card key={application.id} variant="default">
              <View style={styles.row}>
                {application.status === 'APPROVED' ? (
                  <CircleCheck size={18} color={colors.success} />
                ) : (
                  <CircleX size={18} color={colors.danger} />
                )}
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>
                    {application.businessName} — {humanize(application.status)}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {formatDate(application.createdAt)}
                  </Text>
                  {application.decisionNote ? (
                    <Text style={[typography.small, { color: colors.textSecondary }]}>{application.decisionNote}</Text>
                  ) : null}
                </View>
                <Badge
                  label={humanize(application.status)}
                  tone={application.status === 'APPROVED' ? 'success' : 'danger'}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {!pending && applications.isSuccess ? (
        <>
          <View style={{ gap: theme.spacing.sm }}>
            <View style={styles.progressText}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>STEP {step + 1} OF {STEPS.length}</Text>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{STEPS[step]}</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${((step + 1) / STEPS.length) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.chips}>
              {STEPS.map((label, index) => (
                <Chip
                  key={label}
                  label={`${index + 1}. ${label}`}
                  tone="neutral"
                  selected={step === index}
                  disabled={index > step}
                  onPress={() => setStep(index)}
                />
              ))}
            </View>
          </View>

          <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'warning'} />

          {step === 0 ? (
            <Card variant="elevated">
              <View style={{ gap: theme.spacing.md }}>
                <Text style={[typography.h3, { color: colors.text }]}>About you</Text>
                <View style={{ gap: theme.spacing.sm }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>What kind of provider are you?</Text>
                  <View style={styles.chips}>
                    {PROVIDER_TYPES.map((providerType) => (
                      <Chip
                        key={providerType}
                        label={humanize(providerType)}
                        selected={form.providerType === providerType}
                        onPress={() => update('providerType', providerType)}
                      />
                    ))}
                  </View>
                </View>
                <Input
                  label={form.providerType === 'INDIVIDUAL' ? 'Your name as clients see it' : 'Business name'}
                  value={form.businessName}
                  onChangeText={(value) => update('businessName', value)}
                />
                <Input
                  label="What do you offer?"
                  value={form.description}
                  onChangeText={(value) => update('description', value)}
                  placeholder="The work you take on and who you are best for"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </Card>
          ) : null}

          {step === 1 ? (
            <Card variant="elevated">
              <View style={{ gap: theme.spacing.md }}>
                <Text style={[typography.h3, { color: colors.text }]}>Contact and experience</Text>
                <Input
                  label="Phone"
                  value={form.phone}
                  onChangeText={(value) => update('phone', value)}
                  keyboardType="phone-pad"
                  hint="Optional"
                />
                <Input
                  label="Years of experience"
                  value={form.yearsOfExperience}
                  onChangeText={(value) => update('yearsOfExperience', value)}
                  keyboardType="numeric"
                  placeholder="0 to 60"
                />
                <Input
                  label="Website or social page"
                  value={form.websiteUrl}
                  onChangeText={(value) => update('websiteUrl', value)}
                  hint="Optional"
                />
                <Input
                  label="National ID number"
                  value={form.idNumber}
                  onChangeText={(value) => update('idNumber', value)}
                  hint="Optional, not shown publicly"
                />
                {needsLegal ? (
                  <Input
                    label="Business registration number"
                    value={form.registrationNumber}
                    onChangeText={(value) => update('registrationNumber', value)}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card variant="elevated">
              <View style={{ gap: theme.spacing.md }}>
                <Text style={[typography.h3, { color: colors.text }]}>Services you want to offer</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Pick up to 12. You can change these later.</Text>
                <SearchBar
                  value={categoryQuery}
                  onChangeText={setCategoryQuery}
                  placeholder="Search services"
                />
                {categories.isError ? (
                  <ErrorState
                    title="Services unavailable"
                    message={toApiError(categories.error).message}
                    onRetry={() => void categories.refetch()}
                  />
                ) : null}
                {categories.isPending ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    <Skeleton height={14} />
                    <Skeleton height={14} />
                  </View>
                ) : null}
                {categories.isSuccess && leaves.length === 0 ? (
                  <EmptyState
                    title="No service categories"
                    message="Categories are not available right now. You can still apply."
                    actionLabel="Retry"
                    onAction={() => void categories.refetch()}
                  />
                ) : null}
                {grouped.map(([group, items]) => (
                  <View key={group} style={{ gap: theme.spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{group}</Text>
                    <View style={styles.chips}>
                      {items.map((category) => {
                        const active = selectedCategories.includes(category.slug);
                        return (
                          <Chip
                            key={category.slug}
                            label={category.name}
                            selected={active}
                            disabled={!active && selectedCategories.length >= 12}
                            onPress={() => toggleCategory(category.slug)}
                          />
                        );
                      })}
                    </View>
                  </View>
                ))}
                {grouped.length === 0 && categories.isSuccess && leaves.length > 0 ? (
                  <EmptyState title="No matching services" message={`Nothing matches “${categoryQuery.trim()}”.`} />
                ) : null}
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {selectedCategories.length} of 12 selected
                </Text>
              </View>
            </Card>
          ) : null}

          {submit.isError ? (
            <ErrorState
              title="Could not submit application"
              message={toApiError(submit.error).message}
              onRetry={onSubmit}
            />
          ) : null}

          <View style={styles.actions}>
            {step > 0 ? (
              <Button label="Back" variant="secondary" onPress={() => { setNotice(null); setStep(step - 1); }} />
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button label="Continue" onPress={continueToNext} />
            ) : (
              <Button
                label="Submit application"
                onPress={onSubmit}
                loading={submit.isPending}
                disabled={submit.isPending}
                fullWidth
              />
            )}
          </View>

          <Card variant="muted">
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[typography.h3, { color: colors.text }]}>What happens next</Text>
              <Text style={[typography.small, { color: colors.textSecondary }]}>An admin checks your details before upgrading your account.</Text>
              <Text style={[typography.small, { color: colors.textSecondary }]}>On approval, your existing login and request history stay with you.</Text>
              <Text style={[typography.small, { color: colors.textSecondary }]}>You then add services, coverage areas and your availability.</Text>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  progressText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  progressTrack: { height: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: spacing.sm, borderRadius: radius.pill },
});
