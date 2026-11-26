import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import {
  parityCustomerApi,
  type PersonalizationPreferences,
  type UpdatePersonalizationPreferencesDto,
} from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

type ToggleKey = 'personalizationEnabled' | 'locationBasedEnabled' | 'recentlyViewedEnabled';
type InterestFilter = 'all' | 'category' | 'service';
type CategoryOption = { id: string; name: string };

const TOGGLES: Array<{ key: ToggleKey; label: string; description: string }> = [
  {
    key: 'personalizationEnabled',
    label: 'Personalized recommendations',
    description: 'Show providers and services chosen for your past activity.',
  },
  {
    key: 'locationBasedEnabled',
    label: 'Location-based results',
    description: 'Use your area to rank nearby providers higher.',
  },
  {
    key: 'recentlyViewedEnabled',
    label: 'Recently viewed',
    description: 'Use profiles and services you viewed to improve suggestions.',
  },
];

const INTEREST_CEILING = 30;

function flattenCategories(categories: Array<CategoryOption & { children?: CategoryOption[] | null }>): CategoryOption[] {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name },
    ...flattenCategories(category.children ?? []),
  ]);
}

function selectedLabel(ids: string[], options: CategoryOption[]): string {
  if (!ids.length) return 'All';
  return ids
    .map((id) => options.find((option) => option.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

function strength(score: number) {
  const level = Math.max(0, Math.min(5, Math.ceil((score / INTEREST_CEILING) * 5)));
  const label = level >= 4 ? 'Strong' : level >= 2 ? 'Growing' : level > 0 ? 'Light' : 'New';
  return { level, label };
}

export default function PersonalizationSettingsScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, radius, borderWidth } = useTheme();
  const initialized = useRef(false);
  const [prefs, setPrefs] = useState<PersonalizationPreferences | null>(null);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [preferredServices, setPreferredServices] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [interestFilter, setInterestFilter] = useState<InterestFilter>('all');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const preferences = useQuery({ queryKey: ['personalization', 'preferences'], queryFn: () => parityCustomerApi.preferences() });
  const interests = useQuery({ queryKey: ['personalization', 'interests'], queryFn: () => parityCustomerApi.interests() });
  const categories = useQuery({ queryKey: ['personalization', 'categories'], queryFn: () => discoveryApi.categories() });
  const services = useQuery({
    queryKey: ['personalization', 'services'],
    queryFn: () => discoveryApi.services(),
  });

  useEffect(() => {
    if (!preferences.data || initialized.current) return;
    initialized.current = true;
    setPrefs(preferences.data);
    setPreferredCategories(preferences.data.preferredCategories ?? []);
    setPreferredServices(preferences.data.preferredServices ?? []);
    setPriceMin(preferences.data.preferredPriceMin?.toString() ?? '');
    setPriceMax(preferences.data.preferredPriceMax?.toString() ?? '');
    setRadiusKm(preferences.data.preferredSearchRadiusKm?.toString() ?? '');
  }, [preferences.data]);

  const patch = useMutation({
    mutationFn: (dto: UpdatePersonalizationPreferencesDto) => parityCustomerApi.updatePreferences(dto),
    onSuccess: async (data) => {
      setPrefs(data);
      setNotice({ message: 'Preferences saved.', tone: 'success' });
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
    onError: (error) => {
      setNotice(null);
      setSaveError(toApiError(error).message);
    },
  });

  const toggle = (key: ToggleKey, value: boolean) => {
    if (!prefs) return;
    const previous = prefs;
    setPrefs({ ...previous, [key]: value });
    const dto: UpdatePersonalizationPreferencesDto =
      key === 'personalizationEnabled'
        ? { personalizationEnabled: value }
        : key === 'locationBasedEnabled'
          ? { locationBasedEnabled: value }
          : { recentlyViewedEnabled: value };
    patch.mutate(dto, { onError: () => setPrefs(previous) });
  };

  const toggleCategory = (id: string) => {
    const previous = preferredCategories;
    const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
    setPreferredCategories(next);
    patch.mutate({ preferredCategories: next }, { onError: () => setPreferredCategories(previous) });
  };

  const toggleService = (id: string) => {
    const previous = preferredServices;
    const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
    setPreferredServices(next);
    patch.mutate({ preferredServices: next }, { onError: () => setPreferredServices(previous) });
  };

  const parseOptional = (value: string): number | null | undefined => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const saveFilters = () => {
    if (priceMin.trim() && !Number.isFinite(Number(priceMin))) {
      setSaveError('Minimum price must be a number.');
      return;
    }
    if (priceMax.trim() && !Number.isFinite(Number(priceMax))) {
      setSaveError('Maximum price must be a number.');
      return;
    }
    if (radiusKm.trim() && !Number.isFinite(Number(radiusKm))) {
      setSaveError('Search radius must be a number.');
      return;
    }
    setSaveError(null);
    patch.mutate({
      preferredPriceMin: parseOptional(priceMin),
      preferredPriceMax: parseOptional(priceMax),
      preferredSearchRadiusKm: parseOptional(radiusKm),
    });
  };

  const categoryOptions = categories.data ? flattenCategories(categories.data) : [];
  const serviceOptions = services.data ?? [];
  const loading = preferences.isPending || interests.isPending || categories.isPending || services.isPending;
  const visibleInterests = (interests.data ?? []).filter((interest) =>
    interestFilter === 'all' ? true : interestFilter === 'category' ? Boolean(interest.categoryId) : Boolean(interest.serviceId),
  );

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Personalization"
        eyebrow="Preferences"
        subtitle="Recommendations and search defaults"
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />
      <Notice message={saveError} tone="error" />

      {(preferences.isError || interests.isError || categories.isError || services.isError) && !prefs ? (
        <ErrorState
          message="Personalization settings could not be loaded."
          onRetry={() => {
            if (preferences.isError) void preferences.refetch();
            if (interests.isError) void interests.refetch();
            if (categories.isError) void categories.refetch();
            if (services.isError) void services.refetch();
          }}
        />
      ) : loading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={72} />
          <Skeleton height={120} />
          <Skeleton height={180} />
        </View>
      ) : !prefs ? (
        <ErrorState title="No preferences" message="Sign in to manage personalization." onRetry={() => router.push('/(auth)/login')} />
      ) : (
        <>
          <Card>
            <SectionHeader
              title="Recommendations"
              subtitle={`${TOGGLES.filter((item) => prefs[item.key]).length} of ${TOGGLES.length} active · changes save automatically`}
            />
            {TOGGLES.map((item) => (
              <View key={item.key} style={styles.toggleRow}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{item.description}</Text>
                </View>
                <Switch
                  value={Boolean(prefs[item.key])}
                  accessibilityLabel={item.label}
                  disabled={patch.isPending}
                  onValueChange={(value) => toggle(item.key, value)}
                />
              </View>
            ))}
          </Card>

          <Card>
            <SectionHeader title="Preferred categories" subtitle="Chosen categories save automatically and rank higher in search." />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Selected: {selectedLabel(preferredCategories, categoryOptions)}</Text>
            {categories.isError ? (
              <ErrorState message="Categories could not be loaded." onRetry={() => void categories.refetch()} />
            ) : categoryOptions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {categoryOptions.map((category) => (
                  <Chip
                    key={category.id}
                    label={category.name}
                    selected={preferredCategories.includes(category.id)}
                    disabled={patch.isPending}
                    onPress={() => toggleCategory(category.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <EmptyState title="No categories" message="Categories are not available yet." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Preferred services" subtitle="These services save automatically and appear more often in your home." />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Selected: {selectedLabel(preferredServices, serviceOptions)}</Text>
            {services.isError ? (
              <ErrorState message="Services could not be loaded." onRetry={() => void services.refetch()} />
            ) : serviceOptions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {serviceOptions.map((service) => (
                  <Chip
                    key={service.id}
                    label={service.name}
                    selected={preferredServices.includes(service.id)}
                    disabled={patch.isPending}
                    onPress={() => toggleService(service.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <EmptyState title="No services" message="Services are not available yet." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Search defaults" subtitle="Used when filters are not set on a search." />
            <Input label="Minimum price" value={priceMin} onChangeText={setPriceMin} keyboardType="numeric" placeholder="Optional" />
            <Input label="Maximum price" value={priceMax} onChangeText={setPriceMax} keyboardType="numeric" placeholder="Optional" />
            <Input label="Search radius (km)" value={radiusKm} onChangeText={setRadiusKm} keyboardType="numeric" placeholder="Optional" />
            <Button label="Save defaults" onPress={saveFilters} loading={patch.isPending} fullWidth />
          </Card>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Your interests" subtitle="Learned from your activity and saved preferences." />
            <SegmentedControl<InterestFilter>
              value={interestFilter}
              onChange={setInterestFilter}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Categories', value: 'category' },
                { label: 'Services', value: 'service' },
              ]}
            />
            {interests.isError ? (
              <ErrorState message="Interests could not be loaded." onRetry={() => void interests.refetch()} />
            ) : visibleInterests.length ? (
              visibleInterests.map((interest, index) => {
                const { level, label } = strength(interest.effectiveScore);
                return (
                  <Card key={`${interest.categoryId ?? interest.serviceId ?? 'interest'}-${index}`}>
                    <View style={styles.interestRow}>
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <Text style={[typography.bodyStrong, { color: colors.text }]}>
                          {interest.serviceName ?? interest.categoryName ?? 'Interest'}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {interest.serviceName ? 'Service' : 'Category'} · {label} interest
                        </Text>
                      </View>
                      <View
                        accessibilityLabel={`Interest strength ${level} of 5`}
                        style={styles.strength}
                      >
                        {Array.from({ length: 5 }, (_, position) => (
                          <View
                            key={position}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor: position < level ? colors.primary : colors.surfaceMuted,
                                borderRadius: radius.pill,
                                borderWidth: borderWidth.hairline,
                                borderColor: colors.border,
                              },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </Card>
                );
              })
            ) : (
              <EmptyState title="No interests yet" message="Browse providers and services to build your interests." />
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  chips: { gap: 8, paddingVertical: 4 },
  interestRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  strength: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  strengthBar: { width: 10, height: 20 },
});
