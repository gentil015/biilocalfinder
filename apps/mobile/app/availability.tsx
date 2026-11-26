import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { queryKeys, useAvailability } from '@/src/hooks/queries';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { humanize } from '@/src/utils/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Status = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
type Slot = { dayOfWeek: number; startTime: string; endTime: string; isActive: boolean };
type ExceptionItem = { id: string; date: string; isAvailable: boolean; note?: string | null };

const DEFAULT_SLOTS: Slot[] = DAYS.map((_, dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  isActive: dayOfWeek > 0 && dayOfWeek < 6,
}));

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function splitHours(value: unknown): { startTime: string; endTime: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})$/);
  return match ? { startTime: match[1], endTime: match[2] } : null;
}

function slotFrom(value: unknown, fallback: Slot): Slot {
  const record = asRecord(value);
  if (!record) return { ...fallback, isActive: false };
  const displayHours = splitHours(record.hours);
  const startTime = typeof record.startTime === 'string' && record.startTime ? record.startTime : displayHours?.startTime ?? fallback.startTime;
  const endTime = typeof record.endTime === 'string' && record.endTime ? record.endTime : displayHours?.endTime ?? fallback.endTime;
  const isActive =
    typeof record.isActive === 'boolean' ? record.isActive : Boolean(displayHours || (record.startTime && record.endTime));
  return { dayOfWeek: fallback.dayOfWeek, startTime, endTime, isActive };
}

function hydrateSlots(data: Record<string, unknown> | undefined): Slot[] {
  const source = Array.isArray(data?.raw)
    ? data.raw
    : Array.isArray(data?.weekly)
      ? data.weekly
      : [];
  const byDay = new Map<number, unknown>();
  source.forEach((entry) => {
    const record = asRecord(entry);
    const day = Number(record?.dayOfWeek);
    if (Number.isInteger(day) && day >= 0 && day <= 6) byDay.set(day, entry);
  });
  return DEFAULT_SLOTS.map((fallback) =>
    byDay.has(fallback.dayOfWeek) ? slotFrom(byDay.get(fallback.dayOfWeek), fallback) : { ...fallback, isActive: false },
  );
}

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function AvailabilityScreen() {
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const availability = useAvailability();
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [slots, setSlots] = useState<Slot[]>(DEFAULT_SLOTS);
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const hydratedRef = useRef(false);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');
  const [exceptionAvailable, setExceptionAvailable] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!availability.data) return;
    if (!hydratedRef.current || !weeklyDirty) {
      setSlots(hydrateSlots(availability.data));
      hydratedRef.current = true;
      setWeeklyDirty(false);
    }
  }, [availability.data, weeklyDirty]);

  const status = String(availability.data?.status ?? 'AVAILABLE') as Status;
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.availability });
  };
  const statusMutation = useMutation({
    mutationFn: (next: Status) => providerApi.setAvailabilityStatus(next),
    onSuccess: async () => {
      setNotice({ message: 'Status updated.', tone: 'success' });
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });
  const weeklyMutation = useMutation({
    mutationFn: (days: Slot[]) => providerApi.setWeeklyAvailability({ days }),
    onSuccess: async () => {
      hydratedRef.current = false;
      setWeeklyDirty(false);
      setNotice({ message: 'Weekly hours saved.', tone: 'success' });
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });
  const exceptions = ((availability.data?.exceptions ?? []) as ExceptionItem[]);
  const exceptionMutation = useMutation({
    mutationFn: () =>
      providerApi.addAvailabilityException({
        date: exceptionDate,
        isAvailable: exceptionAvailable,
        note: exceptionNote.trim() || undefined,
      }),
    onSuccess: async () => {
      setExceptionDate('');
      setExceptionNote('');
      setExceptionAvailable(false);
      setNotice({ message: 'Date exception saved.', tone: 'success' });
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });
  const deleteException = useMutation({
    mutationFn: (id: string) => providerApi.deleteAvailabilityException(id),
    onSuccess: async () => {
      setPendingDelete(null);
      setNotice({ message: 'Date exception removed.', tone: 'success' });
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const updateSlot = (day: number, patch: Partial<Slot>) => {
    setWeeklyDirty(true);
    setSlots((current) => current.map((slot) => (slot.dayOfWeek === day ? { ...slot, ...patch } : slot)));
  };

  const saveWeekly = () => {
    const activeSlots = slots.filter((slot) => slot.isActive);
    const invalid = activeSlots.some(
      (slot) =>
        !VALID_TIME.test(slot.startTime) || !VALID_TIME.test(slot.endTime) || slot.startTime >= slot.endTime,
    );
    if (invalid) {
      setNotice({ message: 'Use HH:MM times with an end time after the start time.', tone: 'error' });
      return;
    }
    setNotice(null);
    weeklyMutation.mutate(activeSlots);
  };

  if (availability.isError) {
    return (
      <Screen contentStyle={{ gap: spacing.lg }}>
        <AppScreenHeader title="Availability" eyebrow="Provider settings" subtitle="Your hours and open status" />
        <ErrorState message="Availability could not be loaded." onRetry={() => void availability.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
      <AppScreenHeader
        title="Availability"
        eyebrow="Provider settings"
        subtitle="Clients see this on your profile"
        action={<Badge label={humanize(status)} tone={status === 'AVAILABLE' ? 'success' : status === 'BUSY' ? 'warning' : 'neutral'} />}
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      {availability.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} />
          <Skeleton height={220} />
          <Skeleton height={96} />
        </View>
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Current status" subtitle="Clients see this on your profile" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(['AVAILABLE', 'BUSY', 'UNAVAILABLE'] as Status[]).map((option) => (
                <Chip
                  key={option}
                  label={humanize(option)}
                  selected={status === option}
                  disabled={statusMutation.isPending}
                  onPress={() => statusMutation.mutate(option)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Weekly hours" subtitle="Saved times load first; changes stay local until you save." />
            {slots.map((slot) => (
              <Card key={slot.dayOfWeek}>
                <View style={styles.dayRow}>
                  <Text style={[typography.bodyStrong, { color: colors.text, width: 88 }]}>{DAYS[slot.dayOfWeek].slice(0, 3)}</Text>
                  <Switch
                    value={slot.isActive}
                    accessibilityLabel={`${DAYS[slot.dayOfWeek]} available`}
                    onValueChange={(isActive) => updateSlot(slot.dayOfWeek, { isActive })}
                  />
                </View>
                {slot.isActive ? (
                  <View style={styles.times}>
                    <Input label="From" value={slot.startTime} onChangeText={(startTime) => updateSlot(slot.dayOfWeek, { startTime })} placeholder="09:00" />
                    <Input label="To" value={slot.endTime} onChangeText={(endTime) => updateSlot(slot.dayOfWeek, { endTime })} placeholder="17:00" />
                  </View>
                ) : (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Unavailable</Text>
                )}
              </Card>
            ))}
            <Button label="Save weekly hours" onPress={saveWeekly} loading={weeklyMutation.isPending} fullWidth />
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Date exceptions" subtitle="Open or block a specific date." />
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Input
                  label="Date (YYYY-MM-DD)"
                  value={exceptionDate}
                  onChangeText={setExceptionDate}
                  placeholder="2026-12-25"
                  hint="Exception dates override your weekly hours."
                />
                <View style={styles.dayRow}>
                  <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Available on this date</Text>
                  <Switch
                    value={exceptionAvailable}
                    accessibilityLabel="Available on this date"
                    onValueChange={setExceptionAvailable}
                  />
                </View>
                <Input label="Note" value={exceptionNote} onChangeText={setExceptionNote} placeholder="Holiday or special hours" />
                <Button
                  label="Add exception"
                  size="sm"
                  disabled={!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate)}
                  loading={exceptionMutation.isPending}
                  onPress={() => exceptionMutation.mutate()}
                />
              </View>
            </Card>
            {exceptions.length ? (
              <View style={{ gap: spacing.sm }}>
                {exceptions.map((exception) => (
                  <Card key={exception.id} variant="elevated">
                    <View style={styles.dayRow}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[typography.bodyStrong, { color: colors.text }]}>{exception.date.slice(0, 10)}</Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {exception.isAvailable ? 'Available' : 'Blocked'}
                          {exception.note ? ` · ${exception.note}` : ''}
                        </Text>
                      </View>
                      <Button
                        label="Remove"
                        variant="danger"
                        size="sm"
                        onPress={() => setPendingDelete(exception.id)}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            ) : (
              <EmptyState
                icon={<CalendarDays size={24} color={colors.primary} />}
                title="No date exceptions"
                message="Add a date when you need different hours."
              />
            )}
          </View>
        </>
      )}

      <ConfirmDialog
        visible={Boolean(pendingDelete)}
        title="Remove date exception?"
        message="This date will go back to your weekly hours."
        confirmLabel="Remove"
        destructive
        loading={deleteException.isPending}
        onConfirm={() => pendingDelete && deleteException.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  times: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
