import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarDays, GraduationCap, Images, MapPin, Pencil, Trash2, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { Input } from '@/src/components/ui/Input';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import {
  parityProviderApi,
  type ExperienceInput,
  type ExperienceItem,
} from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

const EXPERIENCES_KEY = ['provider', 'parity', 'experience'] as const;

interface ExperienceForm {
  title: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  position: string;
}

interface ExperienceErrors {
  title?: string;
  organization?: string;
  startDate?: string;
  endDate?: string;
  position?: string;
}

interface SaveExperience {
  id?: string;
  payload: ExperienceInput;
}

const EMPTY_FORM: ExperienceForm = {
  title: '',
  organization: '',
  location: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
  position: '',
};

function toForm(item: ExperienceItem): ExperienceForm {
  return {
    title: item.title,
    organization: item.organization,
    location: item.location ?? '',
    startDate: item.startDate,
    endDate: item.endDate ?? '',
    isCurrent: item.isCurrent,
    description: item.description ?? '',
    position: String(item.position),
  };
}

function dateLabel(item: ExperienceItem): string {
  if (item.isCurrent) return `${item.startDate} — Present`;
  return item.endDate ? `${item.startDate} — ${item.endDate}` : item.startDate;
}

export default function ProviderExperienceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const experiences = useQuery({ queryKey: EXPERIENCES_KEY, queryFn: () => parityProviderApi.experiences() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<ExperienceForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ExperienceErrors>({});
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExperienceItem | null>(null);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: EXPERIENCES_KEY });

  const save = useMutation({
    mutationFn: ({ id, payload }: SaveExperience) =>
      id ? parityProviderApi.updateExperience(id, payload) : parityProviderApi.createExperience(payload),
    onSuccess: async () => {
      await invalidate();
      setEditorOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setNotice(null);
      showToast('Experience saved.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => parityProviderApi.deleteExperience(id),
    onSuccess: async () => {
      await invalidate();
      setNotice(null);
      showToast('Experience removed.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const items = experiences.data ?? [];
  const ordered = [...items].sort((a, b) => a.position - b.position);

  const update = <K extends keyof ExperienceForm>(key: K, value: ExperienceForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, position: String(items.length) });
    setErrors({});
    setNotice(null);
    setEditorOpen(true);
  };

  const openEdit = (item: ExperienceItem) => {
    setEditingId(item.id);
    setForm(toForm(item));
    setErrors({});
    setNotice(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setNotice(null);
  };

  const submit = () => {
    const title = form.title.trim();
    const organization = form.organization.trim();
    const startDate = form.startDate.trim();
    const endDate = form.endDate.trim();
    const position = form.position === '' ? items.length : Number(form.position);
    const nextErrors: ExperienceErrors = {};
    if (!title) nextErrors.title = 'Add a job title.';
    if (!organization) nextErrors.organization = 'Add an organization.';
    if (!startDate) nextErrors.startDate = 'Add a start date.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) nextErrors.startDate = 'Use YYYY-MM-DD for dates.';
    if (!form.isCurrent && endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      nextErrors.endDate = 'Use YYYY-MM-DD for dates.';
    } else if (!form.isCurrent && endDate && endDate < startDate) {
      nextErrors.endDate = 'The end date cannot be before the start date.';
    }
    if (!Number.isInteger(position) || position < 0) {
      nextErrors.position = 'Position must be a whole number of 0 or more.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({ message: 'Check the highlighted fields before saving.', tone: 'warning' });
      return;
    }
    save.mutate({
      id: editingId ?? undefined,
      payload: {
        title,
        organization,
        location: form.location.trim() || undefined,
        startDate,
        endDate: form.isCurrent ? null : endDate || null,
        isCurrent: form.isCurrent,
        description: form.description.trim() || undefined,
        position,
      },
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    remove.mutate(id);
  };

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      refreshControl={
        <RefreshControl refreshing={experiences.isFetching} onRefresh={() => void experiences.refetch()} />
      }
    >
      <AppScreenHeader
        eyebrow="Provider tools"
        title="Experience"
        subtitle="Work history shown on your profile"
        action={<Button label="Add" size="sm" onPress={openAdd} />}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Your experience" subtitle={`${items.length} entries`} />
        {experiences.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="65%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="55%" height={12} />
            </Card>
          </View>
        ) : null}
        {experiences.isError ? (
          <ErrorState message="Your experience could not be loaded." onRetry={() => void experiences.refetch()} />
        ) : null}
        {experiences.isSuccess && items.length === 0 && !editorOpen ? (
          <EmptyState
            icon={<BriefcaseBusiness size={24} color={colors.primaryDark} />}
            title="No experience added yet"
            message="Add your roles so clients can see what you have done before."
            actionLabel="Add your first role"
            onAction={openAdd}
          />
        ) : null}
        {ordered.map((item, index) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: item.isCurrent ? colors.success : colors.primary },
                ]}
              />
              {index < ordered.length - 1 ? (
                <View style={[styles.line, { backgroundColor: colors.borderStrong }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: theme.spacing.md }}>
              <Card variant="default">
                <View style={{ gap: theme.spacing.sm }}>
                  <View style={styles.row}>
                    <BriefcaseBusiness size={18} color={colors.primaryDark} />
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <Text style={[typography.bodyStrong, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[typography.small, { color: colors.textSecondary }]}>{item.organization}</Text>
                    </View>
                    {item.isCurrent ? <Badge label="Current" tone="success" /> : null}
                  </View>
                  <View style={styles.metaRow}>
                    <CalendarDays size={14} color={colors.textMuted} />
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{dateLabel(item)}</Text>
                  </View>
                  {item.location ? (
                    <View style={styles.metaRow}>
                      <MapPin size={14} color={colors.textMuted} />
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{item.location}</Text>
                    </View>
                  ) : null}
                  {item.description ? (
                    <Text style={[typography.small, { color: colors.textSecondary }]}>{item.description}</Text>
                  ) : null}
                  <View style={styles.actions}>
                    <Button
                      label="Edit"
                      size="sm"
                      variant="secondary"
                      icon={<Pencil size={14} />}
                      onPress={() => openEdit(item)}
                    />
                    <Button
                      label="Delete"
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      disabled={remove.isPending}
                      onPress={() => setPendingDelete(item)}
                    />
                  </View>
                </View>
              </Card>
            </View>
          </View>
        ))}
      </View>

      {remove.isError ? (
        <ErrorState
          title="Could not delete experience"
          message={toApiError(remove.error).message}
          onRetry={() => {
            if (remove.variables) remove.mutate(remove.variables);
          }}
        />
      ) : null}

      <Card variant="muted">
        <SectionHeader title="More provider tools" />
        <MenuRow
          icon={<GraduationCap size={18} color={colors.primaryDark} />}
          label="Education"
          onPress={() => router.push('/provider/education')}
        />
        <MenuRow
          icon={<Images size={18} color={colors.primaryDark} />}
          label="Portfolio"
          onPress={() => router.push('/provider/portfolio')}
        />
        <MenuRow
          icon={<MapPin size={18} color={colors.primaryDark} />}
          label="Service areas"
          onPress={() => router.push('/provider/service-areas')}
        />
        <MenuRow
          icon={<TrendingUp size={18} color={colors.primaryDark} />}
          label="Insights"
          onPress={() => router.push('/provider/insights')}
        />
      </Card>

      <BottomSheet
        visible={editorOpen}
        title={editingId ? 'Edit experience' : 'Add experience'}
        onClose={closeEditor}
        footer={
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={closeEditor} disabled={save.isPending} />
            <Button
              label={editingId ? 'Save changes' : 'Add experience'}
              onPress={submit}
              loading={save.isPending}
            />
          </View>
        }
      >
        <View style={{ gap: theme.spacing.md }}>
          <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'error'} />
          {save.isError ? (
            <ErrorState title="Could not save experience" message={toApiError(save.error).message} onRetry={submit} />
          ) : null}
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>ROLE</Text>
              <Input label="Title" value={form.title} onChangeText={(value) => update('title', value)} placeholder="e.g. Electrician" error={errors.title} />
              <Input label="Organization" value={form.organization} onChangeText={(value) => update('organization', value)} error={errors.organization} />
              <Input label="Location" value={form.location} onChangeText={(value) => update('location', value)} hint="Optional" />
            </View>
          </Card>
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>DATES</Text>
              <Input
                label="Start date"
                value={form.startDate}
                onChangeText={(value) => update('startDate', value)}
                placeholder="YYYY-MM-DD"
                hint="Use YYYY-MM-DD"
                error={errors.startDate}
              />
              <Input
                label="End date"
                value={form.endDate}
                onChangeText={(value) => update('endDate', value)}
                placeholder="YYYY-MM-DD"
                editable={!form.isCurrent}
                hint={form.isCurrent ? 'Left open while this is your current role' : 'Optional · YYYY-MM-DD'}
                error={errors.endDate}
              />
              <View style={styles.switchRow}>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>I currently work here</Text>
                <Switch
                  accessibilityLabel="I currently work here"
                  value={form.isCurrent}
                  onValueChange={(value) => update('isCurrent', value)}
                />
              </View>
            </View>
          </Card>
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>DETAILS AND ORDER</Text>
              <Input
                label="Description"
                value={form.description}
                onChangeText={(value) => update('description', value)}
                placeholder="What you did and what you were responsible for"
                multiline
                numberOfLines={3}
              />
              <Input
                label="Position"
                value={form.position}
                onChangeText={(value) => update('position', value)}
                keyboardType="numeric"
                hint="Lower numbers appear first"
                error={errors.position}
              />
            </View>
          </Card>
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={Boolean(pendingDelete)}
        title="Delete this experience?"
        message={`${pendingDelete?.title ?? 'This role'} will be removed from your work history.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  line: { width: 2, flex: 1, minHeight: 24 },
});
