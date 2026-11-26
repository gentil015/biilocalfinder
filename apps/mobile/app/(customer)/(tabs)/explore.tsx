import { useMutation } from '@tanstack/react-query';
import { Bookmark, List, Map as MapIcon, Scale, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { ProviderCard } from '@/src/components/domain/ProviderCard';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { Chip } from '@/src/components/ui/Chip';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { Screen } from '@/src/components/ui/Screen';
import { SearchBar } from '@/src/components/ui/SearchBar';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useCategories, useProviderSearch, useServices } from '@/src/hooks/queries';
import { useCurrentLocation } from '@/src/hooks/useLocation';
import { useAppStore } from '@/src/stores/app.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { ProviderSearchParams } from '@/src/services/api/endpoints/discovery';
import { parityCustomerApi } from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';

const SORTS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Nearest', value: 'nearest' },
  { label: 'Top rated', value: 'highest_rated' },
  { label: 'Lowest price', value: 'lowest_price' },
] as const;

function asString(v: string | string[] | undefined) { return Array.isArray(v) ? v[0] : v; }
function asBool(v: string | string[] | undefined) { return asString(v) === 'true'; }

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ q?: string; city?: string; categoryId?: string; serviceId?: string; verifiedOnly?: string; sort?: string; radiusKm?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const selectedLocation = useAppStore((state) => state.selectedLocation);
  const { location: deviceLocation, refresh: refreshLocation } = useCurrentLocation();
  const initialQuery = asString(params.q) || asString(params.city) || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [sort, setSort] = useState<string>(asString(params.sort) ?? 'recommended');
  const [categoryId, setCategoryId] = useState<string | undefined>(asString(params.categoryId));
  const [serviceId, setServiceId] = useState<string | undefined>(asString(params.serviceId));
  const [verifiedOnly, setVerifiedOnly] = useState(asBool(params.verifiedOnly));
  const [radiusKm, setRadiusKm] = useState(asString(params.radiusKm) ?? '15');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const categories = useCategories();
  const services = useServices(categoryId);

  useEffect(() => {
    const next = asString(params.q) || asString(params.city) || '';
    setQuery(next);
    setDebouncedQuery(next);
  }, [params.q, params.city]);
  useEffect(() => { setCategoryId(asString(params.categoryId)); }, [params.categoryId]);
  useEffect(() => { setServiceId(asString(params.serviceId)); }, [params.serviceId]);
  useEffect(() => { setVerifiedOnly(asBool(params.verifiedOnly)); }, [params.verifiedOnly]);
  useEffect(() => { if (asString(params.sort)) setSort(asString(params.sort)!); }, [params.sort]);
  useEffect(() => { if (asString(params.radiusKm)) setRadiusKm(asString(params.radiusKm)!); }, [params.radiusKm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const lat = selectedLocation?.latitude ?? deviceLocation?.latitude;
  const lng = selectedLocation?.longitude ?? deviceLocation?.longitude;
  const searchParams: ProviderSearchParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoryId,
      serviceId,
      lat,
      lng,
      radiusKm: Number(radiusKm) || 15,
      verifiedOnly: verifiedOnly || undefined,
      sort,
      limit: 30,
    }),
    [debouncedQuery, categoryId, serviceId, lat, lng, radiusKm, verifiedOnly, sort],
  );
  const results = useProviderSearch(searchParams);

  const syncParams = (patch: Record<string, string | undefined>) => {
    const next = {
      q: debouncedQuery || undefined,
      categoryId,
      serviceId,
      verifiedOnly: verifiedOnly ? 'true' : undefined,
      sort: sort !== 'recommended' ? sort : undefined,
      radiusKm: radiusKm !== '15' ? radiusKm : undefined,
      ...patch,
    };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>;
    router.setParams(cleaned);
  };
  const aiSearch = useMutation({
    mutationFn: (message: string) =>
      parityCustomerApi.parseSearch({
        message,
        lat,
        lng,
        radiusKm: Number(radiusKm) || 15,
      }),
    onSuccess: async (parsed) => {
      const nextQ = parsed.filters.q ?? '';
      const nextService = parsed.filters.serviceId ?? serviceId;
      const nextRadius = parsed.filters.radiusKm ? String(parsed.filters.radiusKm) : radiusKm;
      setQuery(nextQ);
      setDebouncedQuery(nextQ);
      setServiceId(nextService);
      setRadiusKm(nextRadius);
      setShowAi(false);
      setAiMessage('');
      setNotice(parsed.reply);
      router.setParams(Object.fromEntries(Object.entries({ q: nextQ || undefined, serviceId: nextService, radiusKm: nextRadius !== '15' ? nextRadius : undefined, categoryId, sort: sort !== 'recommended' ? sort : undefined, verifiedOnly: verifiedOnly ? 'true' : undefined }).filter(([, v]) => v)) as Record<string, string>);
      void parityCustomerApi.recordInteraction({ type: 'SEARCH', entityType: 'SERVICE', metadata: { source: 'ai', message: parsed.reply } }).catch(() => undefined);
    },
    onError: (error) => setNotice(toApiError(error).message),
  });

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) { setNotice('You can compare up to three providers.'); return current; }
      return [...current, id];
    });
  };

  const applyLocation = async () => {
    const next = await refreshLocation();
    if (next) await useAppStore.getState().setSelectedLocation(next);
  };

  const activeFilterCount = [categoryId, serviceId, verifiedOnly ? '1' : undefined, radiusKm !== '15' ? '1' : undefined].filter(Boolean).length;
  const activeChips = [
    categoryId ? { key: 'categoryId', label: categories.data?.find((c) => c.id === categoryId)?.name ?? 'Category' } : null,
    serviceId ? { key: 'serviceId', label: services.data?.find((s) => s.id === serviceId)?.name ?? 'Service' } : null,
    verifiedOnly ? { key: 'verifiedOnly', label: 'Verified only' } : null,
    radiusKm !== '15' ? { key: 'radiusKm', label: `${radiusKm} km` } : null,
  ].filter((c): c is { key: string; label: string } => Boolean(c));

  const clearFilter = (key: string) => {
    if (key === 'categoryId') { setCategoryId(undefined); setServiceId(undefined); router.setParams({ categoryId: '', serviceId: '' }); }
    if (key === 'serviceId') { setServiceId(undefined); router.setParams({ serviceId: '' }); }
    if (key === 'verifiedOnly') { setVerifiedOnly(false); router.setParams({ verifiedOnly: '' }); }
    if (key === 'radiusKm') { setRadiusKm('15'); router.setParams({ radiusKm: '' }); }
  };

  const saveSearch = () => {
    router.push({
      pathname: '/saved-searches',
      params: Object.fromEntries(Object.entries({
        q: debouncedQuery || undefined,
        categoryId,
        serviceId,
        verifiedOnly: verifiedOnly ? 'true' : undefined,
        sort: sort !== 'recommended' ? sort : undefined,
        radiusKm: radiusKm !== '15' ? radiusKm : undefined,
      }).filter(([, v]) => v)) as Record<string, string>,
    });
  };

  return (
    <Screen scroll={false} padded={false} contentStyle={styles.root}>
      <View style={[styles.top, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}>
        <View style={{ flex: 1 }}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search providers or services"
            onSubmitEditing={() => syncParams({ q: query.trim() || undefined })}
            onClear={() => { setQuery(''); setDebouncedQuery(''); router.setParams({ q: '' }); }}
          />
        </View>
        <IconButton
          icon={<SlidersHorizontal size={20} />}
          label="Filters"
          onPress={() => setShowFilters(true)}
          badgeCount={activeFilterCount || undefined}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SORTS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={sort === option.value}
            onPress={() => { setSort(option.value); router.setParams({ sort: option.value !== 'recommended' ? option.value : '' }); }}
          />
        ))}
      </ScrollView>

      <View style={[styles.controlsRow, { paddingHorizontal: spacing.lg }]}>
        <View style={{ width: 160 }}>
          <SegmentedControl
            options={[{ label: 'List', value: 'list' }, { label: 'Map', value: 'map' }]}
            value={viewMode}
            onChange={setViewMode}
          />
        </View>
        <View style={styles.inlineActions}>
          <IconButton icon={<Sparkles size={18} />} label="Ask AI" variant="ghost" size={40} onPress={() => setShowAi(true)} />
          <IconButton icon={<Bookmark size={18} />} label="Save search" variant="ghost" size={40} onPress={saveSearch} />
          <IconButton
            icon={<Scale size={18} />}
            label="Compare providers"
            variant={compareIds.length >= 2 ? 'primary' : 'ghost'}
            size={40}
            disabled={compareIds.length < 2}
            onPress={() => router.push({ pathname: '/compare', params: { ids: compareIds.join(',') } })}
            badgeCount={compareIds.length || undefined}
          />
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <Text style={[typography.small, { color: colors.textMuted }]}>
          {results.data ? `${results.data.total} professional${results.data.total === 1 ? '' : 's'} found` : 'Searching…'}
        </Text>
        {!selectedLocation ? (
          <Pressable accessibilityRole="button" onPress={() => void applyLocation()}>
            <Text style={[typography.caption, { color: colors.primaryDark, fontWeight: '600' }]}>Use my location</Text>
          </Pressable>
        ) : null}
      </View>

      {activeChips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {activeChips.map((chip) => (
            <Chip key={chip.key} label={`${chip.label} ×`} selected onPress={() => clearFilter(chip.key)} tone="neutral" />
          ))}
        </ScrollView>
      ) : null}
      {notice ? <Text style={[styles.notice, typography.caption, { color: colors.primaryDark }]}>{notice}</Text> : null}

      {results.isError ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorState message="Search failed. Check your connection and try again." onRetry={() => void results.refetch()} />
        </View>
      ) : viewMode === 'map' ? (
        <MapView
          style={styles.map}
          initialRegion={{ latitude: lat ?? -1.9441, longitude: lng ?? 30.0619, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
        >
          {results.data?.items
            .filter((provider) => provider.latitude !== null && provider.longitude !== null)
            .map((provider) => (
              <Marker
                key={provider.id}
                coordinate={{ latitude: provider.latitude!, longitude: provider.longitude! }}
                title={provider.businessName}
                description={provider.rating ? `${provider.rating.toFixed(1)} ★` : undefined}
                onCalloutPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
              />
            ))}
        </MapView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={results.isFetching && !results.isLoading} onRefresh={() => void results.refetch()} tintColor={colors.primary} />}
        >
          {results.isLoading ? (
            <ListSkeleton rows={4} />
          ) : results.data?.items.length ? (
            results.data.items.map((provider) => (
              <View key={provider.id} style={{ gap: spacing.xs }}>
                <ProviderCard
                  provider={provider}
                  onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
                />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Add ${provider.businessName} to compare`}
                  accessibilityState={{ checked: compareIds.includes(provider.id) }}
                  onPress={() => toggleCompare(provider.id)}
                  style={styles.compareToggle}
                >
                  <Text style={[typography.caption, { color: compareIds.includes(provider.id) ? colors.primaryDark : colors.textMuted, fontWeight: '600' }]}>
                    {compareIds.includes(provider.id) ? '✓ Added to compare' : '+ Add to compare'}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <EmptyState
              title="No professionals found"
              message="Try a broader search, a larger radius, or clearing filters."
              actionLabel="Clear filters"
              onAction={() => {
                setQuery(''); setDebouncedQuery(''); setCategoryId(undefined); setServiceId(undefined);
                setVerifiedOnly(false); setRadiusKm('15'); setSort('recommended');
                router.setParams({ q: '', categoryId: '', serviceId: '', verifiedOnly: '', radiusKm: '', sort: '' });
              }}
            />
          )}
        </ScrollView>
      )}

      <BottomSheet
        visible={showFilters}
        title="Filters"
        onClose={() => setShowFilters(false)}
        footer={
          <Button
            label="Show results"
            onPress={() => {
              router.setParams(Object.fromEntries(Object.entries({
                categoryId, serviceId, verifiedOnly: verifiedOnly ? 'true' : undefined,
                radiusKm: radiusKm !== '15' ? radiusKm : undefined,
                sort: sort !== 'recommended' ? sort : undefined,
                q: debouncedQuery || undefined,
              }).filter(([, v]) => v)) as Record<string, string>);
              setShowFilters(false);
            }}
            fullWidth
          />
        }
      >
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <Chip label="Any" selected={!categoryId} onPress={() => { setCategoryId(undefined); setServiceId(undefined); }} />
              {categories.data?.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => { setCategoryId(c.id === categoryId ? undefined : c.id); setServiceId(undefined); }} />
              ))}
            </ScrollView>
          </View>
          {categoryId && services.data?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                <Chip label="Any" selected={!serviceId} onPress={() => setServiceId(undefined)} />
                {services.data.map((s) => (
                  <Chip key={s.id} label={s.name} selected={serviceId === s.id} onPress={() => setServiceId(serviceId === s.id ? undefined : s.id)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Search radius (km)</Text>
            <Input value={radiusKm} onChangeText={setRadiusKm} keyboardType="numeric" placeholder="15" />
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verifiedOnly }} onPress={() => setVerifiedOnly((v) => !v)} style={styles.checkRow}>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Verified providers only</Text>
            <View style={[styles.checkbox, { backgroundColor: verifiedOnly ? colors.primary : colors.surfaceAlt, borderColor: colors.border }]} />
          </Pressable>
          <Button label="Clear filters" variant="ghost" onPress={() => { setCategoryId(undefined); setServiceId(undefined); setVerifiedOnly(false); setRadiusKm('15'); setSort('recommended'); setQuery(''); setDebouncedQuery(''); router.setParams({ q: '', categoryId: '', serviceId: '', verifiedOnly: '', radiusKm: '', sort: '' }); }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={showAi} title="AI search" onClose={() => setShowAi(false)}>
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.small, { color: colors.textSecondary }]}>
            Describe what you need in plain language. AI processing is used to interpret your request.
          </Text>
          <Input
            label="Your search"
            value={aiMessage}
            onChangeText={setAiMessage}
            multiline
            numberOfLines={3}
            placeholder="I need a plumber in Kigali today"
          />
          <Button
            label="Find providers"
            onPress={() => aiMessage.trim() && aiSearch.mutate(aiMessage.trim())}
            loading={aiSearch.isPending}
            disabled={!aiMessage.trim()}
            fullWidth
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexGrow: 0 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  filterChips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexGrow: 0 },
  notice: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  compareToggle: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  map: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.lg, borderRadius: radius.lg },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1 },
});
