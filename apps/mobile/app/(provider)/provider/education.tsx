import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, CalendarDays, GraduationCap, Images, MapPin, Pencil, Trash2, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  type EducationInput,
  type EducationItem,
} from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

const EDUCATION_KEY = ['provider', 'parity', 'education'] as const;

interface EducationForm {
  school: string;
  degree: string;
  fieldOfStudy: string;
  skills: string;
  startDate: string;
  endDate: string;
  description: string;
  position: string;
}

interface EducationErrors {
  school?: string;
  startDate?: string;
  endDate?: string;
  position?: string;
}

interface SaveEducation {
  id?: string;
  payload: EducationInput;
}

const EMPTY_FORM: EducationForm = {
  school: '',
  degree: '',
  fieldOfStudy: '',
  skills: '',
  startDate: '',
  endDate: '',
  description: '',
  position: '',
};

function toForm(item: EducationItem): EducationForm {
  return {
    school: item.school,
    degree: item.degree ?? '',
    fieldOfStudy: item.fieldOfStudy ?? '',
    skills: (item.skills ?? []).join(', '),
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
    description: item.description ?? '',
    position: String(item.position),
  };
}

function dateLabel(item: EducationItem): string {
  if (item.startDate && item.endDate) return `${item.startDate} — ${item.endDate}`;
  if (item.startDate) return `From ${item.startDate}`;
  if (item.endDate) return `Until ${item.endDate}`;
  return 'Dates not set';
}

export default function ProviderEducationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const education = useQuery({ queryKey: EDUCATION_KEY, queryFn: () => parityProviderApi.educations() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<EducationForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<EducationErrors>({});
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EducationItem | null>(null);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: EDUCATION_KEY });

  const save = useMutation({
    mutationFn: ({ id, payload }: SaveEducation) =>
      id ? parityProviderApi.updateEducation(id, payload) : parityProviderApi.createEducation(payload),
    onSuccess: async () => {
      await invalidate();
      setEditorOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setNotice(null);
      showToast('Education saved.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => parityProviderApi.deleteEducation(id),
    onSuccess: async () => {
      await invalidate();
      setNotice(null);
      showToast('Education removed.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const items = education.data ?? [];
  const ordered = [...items].sort((a, b) => a.position - b.position);

  const update = <K extends keyof EducationForm>(key: K, value: EducationForm[K]) => {
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

  const openEdit = (item: EducationItem) => {
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
    const school = form.school.trim();
    const startDate = form.startDate.trim();
    const endDate = form.endDate.trim();
    const position = form.position === '' ? items.length : Number(form.position);
    const nextErrors: EducationErrors = {};
    if (!school) nextErrors.school = 'Add the school or institution name.';
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) nextErrors.startDate = 'Use YYYY-MM-DD for dates.';
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) nextErrors.endDate = 'Use YYYY-MM-DD for dates.';
    if (startDate && endDate && endDate < startDate) nextErrors.endDate = 'The end date cannot be before the start date.';
    if (!Number.isInteger(position) || position < 0) {
      nextErrors.position = 'Position must be a whole number of 0 or more.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({ message: 'Check the highlighted fields before saving.', tone: 'warning' });
      return;
    }
    const skills = form.skills
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 20);
    save.mutate({
      id: editingId ?? undefined,
      payload: {
        school,
        degree: form.degree.trim() || undefined,
        fieldOfStudy: form.fieldOfStudy.trim() || undefined,
        skills,
        startDate: startDate || null,
        endDate: endDate || null,
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
        <RefreshControl refreshing={education.isFetching} onRefresh={() => void education.refetch()} />
      }
    >
      <AppScreenHeader
        eyebrow="Provider tools"
        title="Education"
        subtitle="Qualifications shown on your profile"
        action={<Button label="Add" size="sm" onPress={openAdd} />}
      />

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Your education" subtitle={`${items.length} entries`} />
        {education.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="70%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="60%" height={12} />
            </Card>
          </View>
        ) : null}
        {education.isError ? (
          <ErrorState message="Your education could not be loaded." onRetry={() => void education.refetch()} />
        ) : null}
        {education.isSuccess && items.length === 0 && !editorOpen ? (
          <EmptyState
            icon={<GraduationCap size={24} color={colors.primaryDark} />}
            title="No education added yet"
            message="Add a qualification or training programme to complete your profile."
            actionLabel="Add your first qualification"
            onAction={openAdd}
          />
        ) : null}
        {ordered.map((item, index) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              {index < ordered.length - 1 ? (
                <View style={[styles.line, { backgroundColor: colors.borderStrong }]} />
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: theme.spacing.md }}>
              <Card variant="default">
                <View style={{ gap: theme.spacing.sm }}>
                  <View style={styles.row}>
                    <GraduationCap size={18} color={colors.primaryDark} />
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <Text style={[typography.bodyStrong, { color: colors.text }]}>{item.school}</Text>
                      {item.degree || item.fieldOfStudy ? (
                        <Text style={[typography.small, { color: colors.textSecondary }]}>
                          {[item.degree, item.fieldOfStudy].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <CalendarDays size={14} color={colors.textMuted} />
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{dateLabel(item)}</Text>
                  </View>
                  {item.skills?.length ? (
                    <View style={styles.skills}>
                      {item.skills.map((skill) => (
                        <Badge key={skill} label={skill} tone="accent" />
                      ))}
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
          title="Could not delete education"
          message={toApiError(remove.error).message}
          onRetry={() => {
            if (remove.variables) remove.mutate(remove.variables);
          }}
        />
      ) : null}

      <Card variant="muted">
        <SectionHeader title="More provider tools" />
        <MenuRow
          icon={<BriefcaseBusiness size={18} color={colors.primaryDark} />}
          label="Experience"
          onPress={() => router.push('/provider/experience')}
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
        title={editingId ? 'Edit education' : 'Add education'}
        onClose={closeEditor}
        footer={
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={closeEditor} disabled={save.isPending} />
            <Button
              label={editingId ? 'Save changes' : 'Add education'}
              onPress={submit}
              loading={save.isPending}
            />
          </View>
        }
      >
        <View style={{ gap: theme.spacing.md }}>
          <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'error'} />
          {save.isError ? (
            <ErrorState title="Could not save education" message={toApiError(save.error).message} onRetry={submit} />
          ) : null}
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>QUALIFICATION</Text>
              <Input label="School or institution" value={form.school} onChangeText={(value) => update('school', value)} error={errors.school} />
              <Input label="Degree or programme" value={form.degree} onChangeText={(value) => update('degree', value)} hint="Optional" />
              <Input label="Field of study" value={form.fieldOfStudy} onChangeText={(value) => update('fieldOfStudy', value)} hint="Optional" />
            </View>
          </Card>
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>SKILLS AND DATES</Text>
              <Input
                label="Skills"
                value={form.skills}
                onChangeText={(value) => update('skills', value)}
                placeholder="Project management, plumbing, safety"
                hint="Comma-separated, up to 20 skills"
              />
              <Input
                label="Start date"
                value={form.startDate}
                onChangeText={(value) => update('startDate', value)}
                placeholder="YYYY-MM-DD"
                hint="Optional · use YYYY-MM-DD"
                error={errors.startDate}
              />
              <Input
                label="End date"
                value={form.endDate}
                onChangeText={(value) => update('endDate', value)}
                placeholder="YYYY-MM-DD"
                hint="Optional · use YYYY-MM-DD"
                error={errors.endDate}
              />
            </View>
          </Card>
          <Card variant="muted">
            <View style={{ gap: theme.spacing.md }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>DETAILS AND ORDER</Text>
              <Input
                label="Description"
                value={form.description}
                onChangeText={(value) => update('description', value)}
                placeholder="Modules, awards or training highlights"
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
        title="Delete this qualification?"
        message={`${pendingDelete?.school ?? 'This qualification'} will be removed from your education history.`}
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
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  line: { width: 2, flex: 1, minHeight: 24 },
});
