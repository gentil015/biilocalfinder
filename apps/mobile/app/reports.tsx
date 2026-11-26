import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import {
  REPORT_CATEGORIES,
  parityCustomerApi,
  type ReportCategory,
  type TrustReport,
} from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { formatDate, humanize } from '@/src/utils/format';

type ReportRow = {
  id: string;
  title: string;
  details?: string | null;
  meta: string;
  status: string;
  createdAt: string;
  resolution?: string | null;
};

const browseRoute: Href = '/(customer)/(tabs)/explore';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'success';
  if (status === 'ESCALATED') return 'danger';
  return 'warning';
}

function asRow(report: TrustReport): ReportRow {
  return {
    id: report.id,
    title: humanize(report.category),
    details: report.description,
    meta: `Provider · ${[report.reportedUser?.firstName, report.reportedUser?.lastName].filter(Boolean).join(' ') || 'Reported provider'}`,
    status: report.status,
    createdAt: report.createdAt,
    resolution: report.resolution,
  };
}

export default function ReportsScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const params = useLocalSearchParams<{ providerId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [providerId, setProviderId] = useState(typeof params.providerId === 'string' ? params.providerId : '');
  const [category, setCategory] = useState<ReportCategory>(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const reports = useQuery({ queryKey: ['reports', 'mine'], queryFn: () => parityCustomerApi.myReports() });
  const trustReports = useQuery({ queryKey: ['reports', 'trust', 'mine'], queryFn: () => parityCustomerApi.myTrustReports() });

  const create = useMutation({
    mutationFn: () =>
      parityCustomerApi.reportProvider(providerId.trim(), {
        category,
        description: description.trim(),
      }),
    onSuccess: async () => {
      setProviderId('');
      setDescription('');
      setNotice({ message: 'Report sent to the trust and safety team.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const submit = () => {
    if (!providerId.trim()) {
      setNotice({ message: 'Enter the provider ID you want to report.', tone: 'error' });
      return;
    }
    if (description.trim().length < 20) {
      setNotice({ message: 'Describe what happened in at least 20 characters.', tone: 'error' });
      return;
    }
    setNotice(null);
    create.mutate();
  };

  const rows: ReportRow[] = [
    ...(reports.data ?? []).map((report) => ({
      id: report.id,
      title: report.reason || humanize(report.category),
      details: report.details,
      meta: `${humanize(report.targetType)} · ${humanize(report.category)}`,
      status: report.status,
      createdAt: report.createdAt,
      resolution: report.resolution,
    })),
    ...(trustReports.data ?? []).map(asRow),
  ];

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="My reports"
        eyebrow="Trust and safety"
        subtitle="Send a report and follow its outcome"
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      <Card>
        <SectionHeader title="Report a provider" subtitle="Reports go to the trust and safety team." />
        <Input label="Provider ID" value={providerId} onChangeText={setProviderId} placeholder="Provider UUID" autoCapitalize="none" />
        {typeof params.providerId === 'string' && params.providerId ? (
          <View style={styles.target}>
            <Badge label="Provider from this profile" tone="accent" />
            <Input label="Reporting" value={params.providerId} onChangeText={() => undefined} editable={false} autoCapitalize="none" />
          </View>
        ) : null}
        <Text style={[typography.bodyStrong, { color: colors.text }]}>Category</Text>
        <View style={styles.categories}>
          {REPORT_CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={humanize(option)}
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Explain what happened and why it is a concern"
          multiline
          numberOfLines={5}
          hint={`${description.trim().length}/20 characters minimum`}
        />
        <Button label="Submit report" variant="secondary" onPress={submit} loading={create.isPending} fullWidth />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Reports you have sent" subtitle="Generic reports and provider safety reports." />
        {reports.isError || trustReports.isError ? (
          <ErrorState
            message="Your reports could not be loaded."
            onRetry={() => {
              if (reports.isError) void reports.refetch();
              if (trustReports.isError) void trustReports.refetch();
            }}
          />
        ) : reports.isPending || trustReports.isPending ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={88} />
            <Skeleton height={88} />
          </View>
        ) : rows.length ? (
          rows.map((row) => (
            <Card key={row.id} variant="elevated">
              <View style={styles.row}>
                <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>{row.title}</Text>
                <Badge label={humanize(row.status)} tone={statusTone(row.status)} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{row.meta}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(row.createdAt)}</Text>
              {row.details ? <Text style={[typography.small, { color: colors.textSecondary }]}>{row.details}</Text> : null}
              {row.resolution ? (
                <View style={[styles.resolution, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Outcome</Text>
                  <Text style={[typography.small, { color: colors.text }]}>{row.resolution}</Text>
                </View>
              ) : null}
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<Flag size={24} color={colors.primary} />}
            title="No reports yet"
            message="Reports you send from a provider profile or safety form will appear here."
            actionLabel="Find providers"
            onAction={() => router.push(browseRoute)}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  target: { gap: 8, paddingTop: 4 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resolution: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
});
