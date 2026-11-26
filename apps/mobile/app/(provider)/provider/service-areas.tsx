import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BriefcaseBusiness, GraduationCap, Images, MapPin, Trash2, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys, useProviderProfile } from '@/src/hooks/queries';
import {
  parityProviderApi,
  type AddServiceAreaDto,
  type ServiceArea,
} from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

interface AreaErrors {
  label?: string;
  latitude?: string;
  longitude?: string;
  radiusKm?: string;
}

export default function ProviderServiceAreasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const profile = useProviderProfile();
  const [label, setLabel] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusKm, setRadiusKm] = useState('10');
  const [errors, setErrors] = useState<AreaErrors>({});
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ServiceArea | null>(null);

  const location = profile.data?.location;
  useEffect(() => {
    if (!location) return;
    setLatitude((current) => (current === '' ? String(location.latitude) : current));
    setLongitude((current) => (current === '' ? String(location.longitude) : current));
  }, [location?.latitude, location?.longitude]);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: queryKeys.providerProfile });

  const add = useMutation({
    mutationFn: (dto: AddServiceAreaDto) => parityProviderApi.addServiceArea(dto),
    onSuccess: async () => {
      await invalidate();
      setLabel('');
      setNotice(null);
      showToast('Coverage area added.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => parityProviderApi.deleteServiceArea(id),
    onSuccess: async () => {
      await invalidate();
      setNotice(null);
      showToast('Coverage area removed.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const areas = profile.data?.serviceAreas ?? [];

  const submit = () => {
    const name = label.trim();
    const lat = Number(latitude);
    const lng = Number(longitude);
    const radius = Number(radiusKm);
    const nextErrors: AreaErrors = {};
    if (name.length === 0) nextErrors.label = 'Give this area a name.';
    if (latitude.trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      nextErrors.latitude = 'Latitude must be between -90 and 90.';
    }
    if (longitude.trim() === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      nextErrors.longitude = 'Longitude must be between -180 and 180.';
    }
    if (!Number.isFinite(radius) || radius < 1) nextErrors.radiusKm = 'Radius must be at least 1 km.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({ message: 'Check the highlighted fields before adding this area.', tone: 'warning' });
      return;
    }
    setNotice(null);
    add.mutate({ label: name, latitude: lat, longitude: lng, radiusKm: radius });
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    const id = pendingRemove.id;
    setPendingRemove(null);
    remove.mutate(id);
  };

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      refreshControl={
        <RefreshControl refreshing={profile.isFetching} onRefresh={() => void profile.refetch()} />
      }
    >
      <AppScreenHeader
        eyebrow="Provider tools"
        title="Service areas"
        subtitle="Where you can serve clients"
      />

      <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'error'} />

      <Card variant="elevated">
        <View style={styles.formGroup}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>AREA DETAILS</Text>
          <Input
            label="Area name"
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Kigali city"
            error={errors.label}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>CENTRE POINT</Text>
          <Input
            label="Latitude"
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numeric"
            placeholder="-1.9441"
            hint="Pre-filled from your saved location when available"
            error={errors.latitude}
          />
          <Input
            label="Longitude"
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numeric"
            placeholder="30.0619"
            error={errors.longitude}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>COVERAGE</Text>
          <Input
            label="Radius in km"
            value={radiusKm}
            onChangeText={setRadiusKm}
            keyboardType="numeric"
            hint="Minimum 1 km"
            error={errors.radiusKm}
          />
        </View>
        <Button label="Add area" onPress={submit} loading={add.isPending} fullWidth />
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Your areas" subtitle={`${areas.length} saved`} />
        {profile.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="55%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="65%" height={12} />
            </Card>
          </View>
        ) : null}
        {profile.isError ? (
          <ErrorState message="Your service areas could not be loaded." onRetry={() => void profile.refetch()} />
        ) : null}
        {profile.isSuccess && areas.length === 0 ? (
          <EmptyState
            icon={<MapPin size={24} color={colors.primaryDark} />}
            title="No coverage areas yet"
            message="Add an area so nearby clients know you can reach them."
          />
        ) : null}
        {areas.map((area) => (
          <Card key={area.id} variant="default">
            <View style={styles.row}>
              <MapPin size={18} color={colors.primaryDark} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{area.label}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                </Text>
              </View>
              <Badge label={`${area.radiusKm} km`} tone="success" />
              <IconButton
                icon={<Trash2 size={18} />}
                label={`Remove ${area.label}`}
                variant="ghost"
                tone="danger"
                size={theme.hit.compact}
                disabled={remove.isPending}
                onPress={() => setPendingRemove(area)}
              />
            </View>
          </Card>
        ))}
      </View>

      <Card variant="muted">
        <SectionHeader title="More provider tools" />
        <MenuRow
          icon={<Images size={18} color={colors.primaryDark} />}
          label="Portfolio"
          onPress={() => router.push('/provider/portfolio')}
        />
        <MenuRow
          icon={<BriefcaseBusiness size={18} color={colors.primaryDark} />}
          label="Experience"
          onPress={() => router.push('/provider/experience')}
        />
        <MenuRow
          icon={<GraduationCap size={18} color={colors.primaryDark} />}
          label="Education"
          onPress={() => router.push('/provider/education')}
        />
        <MenuRow
          icon={<TrendingUp size={18} color={colors.primaryDark} />}
          label="Insights"
          onPress={() => router.push('/provider/insights')}
        />
      </Card>

      <ConfirmDialog
        visible={Boolean(pendingRemove)}
        title="Remove service area?"
        message={`Clients will no longer see ${pendingRemove?.label ?? 'this area'} as part of your coverage.`}
        confirmLabel="Remove area"
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formGroup: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
