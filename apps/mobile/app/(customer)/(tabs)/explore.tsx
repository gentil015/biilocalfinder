import { useMutation, useQuery } from '@tanstack/react-query';
import { Bookmark, Check, MapPin, Navigation, Scale, SlidersHorizontal, Sparkles } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { discoveryApi, type ProviderSearchParams } from '@/src/services/api/endpoints/discovery';
import { parityCustomerApi } from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';

const SORTS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Nearest', value: 'nearest' },
  { label: 'Top rated', value: 'highest_rated' },
  { label: 'Lowest price', value: 'lowest_price' },
  { label: 'Most experienced', value: 'most_experienced' },
  { label: 'Available now', value: 'available_now' },
] as const;

type ExploreParams = {
  q?: string;
  city?: string;
  categoryId?: string;
  serviceId?: string;
  verifiedOnly?: string;
  sort?: string;
  radiusKm?: string;
  minRating?: string;
  minPrice?: string;
  maxPrice?: string;
  minExperience?: string;
  availableNow?: string;
  attributes?: string;
};

type CategoryAttribute = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isFilterable?: boolean;
  options: string[];
};

function asString(v: string | string[] | undefined) { return Array.isArray(v) ? v[0] : v; }
function asBool(v: string | string[] | undefined) { return asString(v) === 'true'; }
function asNumber(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function parseAttributes(v: string | string[] | undefined): Record<string, string> {
  const raw = asString(v);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
    );
  } catch {
    return {};
  }
}
function stringifyAttributes(attributes: Record<string, string>): string | undefined {
  return Object.keys(attributes).length ? JSON.stringify(attributes) : undefined;
}
function asCategoryAttributes(value: unknown[] | undefined): CategoryAttribute[] {
  return (value ?? []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    if (raw.isFilterable !== true || typeof raw.slug !== 'string' || typeof raw.name !== 'string') return [];
    const options = Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === 'string') : [];
    return [{
      id: typeof raw.id === 'string' ? raw.id : raw.slug,
      name: raw.name,
      slug: raw.slug,
      type: typeof raw.type === 'string' ? raw.type : 'TEXT',
      isFilterable: true,
      options,
    }];
  });
}

function AttributeFilterInput({
  attribute,
  value,
  onChange,
}: {
  attribute: CategoryAttribute;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const { colors } = useTheme();
  if (attribute.type === 'BOOLEAN') {
    return (
      <View style={styles.attributeRow}>
        <Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>{attribute.name}</Text>
        <View style={styles.sheetChips}>
          {[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }].map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(value === option.value ? undefined : option.value)}
            />
          ))}
        </View>
      </View>
    );
  }
  if (attribute.type === 'SELECT' || attribute.type === 'MULTI_SELECT') {
    return (
      <View style={styles.attributeBlock}>
        <Text style={[typography.small, { color: colors.textSecondary }]}>{attribute.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attributeChips}>
          {attribute.options.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={value === option}
              onPress={() => onChange(value === option ? undefined : option)}
            />
          ))}
        </ScrollView>
      </View>
    );
  }
  return (
    <Input
      label={attribute.name}
      value={value ?? ''}
      onChangeText={(text) => onChange(text || undefined)}
      keyboardType={attribute.type === 'NUMBER' || attribute.type === 'PRICE' ? 'numeric' : 'default'}
      placeholder={attribute.options?.join(', ')}
    />
  );
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<ExploreParams>();
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
  const [minRating, setMinRating] = useState(asString(params.minRating) ?? '');
  const [minPrice, setMinPrice] = useState(asString(params.minPrice) ?? '');
  const [maxPrice, setMaxPrice] = useState(asString(params.maxPrice) ?? '');
  const [minExperience, setMinExperience] = useState(asString(params.minExperience) ?? '');
  const [availableNow, setAvailableNow] = useState(asBool(params.availableNow));
  const [attributes, setAttributes] = useState<Record<string, string>>(() => parseAttributes(params.attributes));
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const seededFromPreferences = useRef(false);
  const explicitRadius = asString(params.radiusKm) !== undefined;
  const explicitMinPrice = asString(params.minPrice) !== undefined;
  const explicitMaxPrice = asString(params.maxPrice) !== undefined;
  const categories = useCategories();
  const services = useServices(categoryId);
  const categoryAttributes = useQuery({
    queryKey: ['category-attributes', categoryId ?? null],
    queryFn: () => discoveryApi.categoryAttributes(categoryId!),
    enabled: Boolean(categoryId),
  });
  const preferences = useQuery({
    queryKey: ['personalization', 'preferences'],
    queryFn: () => parityCustomerApi.preferences(),
  });

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
  useEffect(() => { setMinRating(asString(params.minRating) ?? ''); }, [params.minRating]);
  useEffect(() => { setMinPrice(asString(params.minPrice) ?? ''); }, [params.minPrice]);
  useEffect(() => { setMaxPrice(asString(params.maxPrice) ?? ''); }, [params.maxPrice]);
  useEffect(() => { setMinExperience(asString(params.minExperience) ?? ''); }, [params.minExperience]);
  useEffect(() => { setAvailableNow(asBool(params.availableNow)); }, [params.availableNow]);
  useEffect(() => { setAttributes(parseAttributes(params.attributes)); }, [params.attributes]);

  useEffect(() => {
    if (seededFromPreferences.current || !preferences.data) return;
    seededFromPreferences.current = true;
    if (!explicitRadius && preferences.data.preferredSearchRadiusKm != null) setRadiusKm(String(preferences.data.preferredSearchRadiusKm));
    if (!explicitMinPrice && preferences.data.preferredPriceMin != null) setMinPrice(String(preferences.data.preferredPriceMin));
    if (!explicitMaxPrice && preferences.data.preferredPriceMax != null) setMaxPrice(String(preferences.data.preferredPriceMax));
  }, [preferences.data, explicitRadius, explicitMinPrice, explicitMaxPrice]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const lat = selectedLocation?.latitude ?? deviceLocation?.latitude;
  const lng = selectedLocation?.longitude ?? deviceLocation?.longitude;
  const locationLabel = selectedLocation?.label ?? (deviceLocation ? 'Current location' : 'Set your location');
  const searchParams: ProviderSearchParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoryId,
      serviceId,
      lat,
      lng,
      radiusKm: Number(radiusKm) || 15,
      minRating: asNumber(minRating),
      minPrice: asNumber(minPrice),
      maxPrice: asNumber(maxPrice),
      minExperience: asNumber(minExperience),
      availableNow: availableNow || undefined,
      verifiedOnly: verifiedOnly || undefined,
      sort,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      limit: 30,
    }),
    [debouncedQuery, categoryId, serviceId, lat, lng, radiusKm, minRating, minPrice, maxPrice, minExperience, availableNow, verifiedOnly, sort, attributes],
  );
  const results = useProviderSearch(searchParams);

  const routeParams = (patch: Record<string, string | undefined> = {}) => {
    const next = {
      q: debouncedQuery || undefined,
      categoryId,
      serviceId,
      verifiedOnly: verifiedOnly ? 'true' : undefined,
      sort: sort !== 'recommended' ? sort : undefined,
      radiusKm: radiusKm !== '15' ? radiusKm : undefined,
      minRating: minRating || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      minExperience: minExperience || undefined,
      availableNow: availableNow ? 'true' : undefined,
      attributes: stringifyAttributes(attributes),
      ...patch,
    };
    return Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Record<string, string>;
  };
  const syncParams = (patch: Record<string, string | undefined>) => router.setParams(routeParams(patch));
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
      const nextCategory = parsed.filters.categoryId ?? categoryId;
      const nextService = parsed.filters.serviceId ?? serviceId;
      const nextRadius = parsed.filters.radiusKm ? String(parsed.filters.radiusKm) : radiusKm;
      const nextSort = parsed.filters.sort && SORTS.some((option) => option.value === parsed.filters.sort) ? parsed.filters.sort : sort;
      const nextMinRating = parsed.filters.minRating !== undefined ? String(parsed.filters.minRating) : minRating;
      const nextMinPrice = parsed.filters.minPrice !== undefined ? String(parsed.filters.minPrice) : minPrice;
      const nextMaxPrice = parsed.filters.maxPrice !== undefined ? String(parsed.filters.maxPrice) : maxPrice;
      const nextMinExperience = parsed.filters.minExperience !== undefined ? String(parsed.filters.minExperience) : minExperience;
      const nextAvailableNow = parsed.filters.availableNow ?? availableNow;
      const nextVerifiedOnly = parsed.filters.verifiedOnly ?? verifiedOnly;
      const nextAttributes = parsed.attributes ?? attributes;
      setQuery(nextQ);
      setDebouncedQuery(nextQ);
      setCategoryId(nextCategory);
      setServiceId(nextService);
      setRadiusKm(nextRadius);
      setSort(nextSort);
      setMinRating(nextMinRating);
      setMinPrice(nextMinPrice);
      setMaxPrice(nextMaxPrice);
      setMinExperience(nextMinExperience);
      setAvailableNow(nextAvailableNow);
      setVerifiedOnly(nextVerifiedOnly);
      setAttributes(nextAttributes);
      setShowAi(false);
      setAiMessage('');
      setNotice(parsed.reply);
      router.setParams(Object.fromEntries(Object.entries({
        q: nextQ || undefined,
        categoryId: nextCategory,
        serviceId: nextService,
        verifiedOnly: nextVerifiedOnly ? 'true' : undefined,
        sort: nextSort !== 'recommended' ? nextSort : undefined,
        radiusKm: nextRadius !== '15' ? nextRadius : undefined,
        minRating: nextMinRating || undefined,
        minPrice: nextMinPrice || undefined,
        maxPrice: nextMaxPrice || undefined,
        minExperience: nextMinExperience || undefined,
        availableNow: nextAvailableNow ? 'true' : undefined,
        attributes: stringifyAttributes(nextAttributes),
      }).filter(([, v]) => v)) as Record<string, string>);
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

  const attributeChips = Object.entries(attributes).map(([slug, value]) => ({ key: `attribute:${slug}`, label: `${slug}: ${value}` }));
  const activeFilterCount = [
    categoryId, serviceId, verifiedOnly ? '1' : undefined, radiusKm !== '15' ? '1' : undefined,
    minRating || undefined, minPrice || undefined, maxPrice || undefined, minExperience || undefined,
    availableNow ? '1' : undefined, ...Object.keys(attributes),
  ].filter(Boolean).length;
  const activeChips = [
    categoryId ? { key: 'categoryId', label: categories.data?.find((c) => c.id === categoryId)?.name ?? 'Category' } : null,
    serviceId ? { key: 'serviceId', label: services.data?.find((s) => s.id === serviceId)?.name ?? 'Service' } : null,
    verifiedOnly ? { key: 'verifiedOnly', label: 'Verified only' } : null,
    radiusKm !== '15' ? { key: 'radiusKm', label: `${radiusKm} km` } : null,
    minRating ? { key: 'minRating', label: `${minRating}+ stars` } : null,
    minPrice ? { key: 'minPrice', label: `From ${minPrice}` } : null,
    maxPrice ? { key: 'maxPrice', label: `Up to ${maxPrice}` } : null,
    minExperience ? { key: 'minExperience', label: `${minExperience}+ years` } : null,
    availableNow ? { key: 'availableNow', label: 'Available now' } : null,
    ...attributeChips,
  ].filter((c): c is { key: string; label: string } => Boolean(c));

  const clearAll = () => {
    setQuery(''); setDebouncedQuery(''); setCategoryId(undefined); setServiceId(undefined);
    setVerifiedOnly(false); setRadiusKm('15'); setSort('recommended');
    setMinRating(''); setMinPrice(''); setMaxPrice(''); setMinExperience('');
    setAvailableNow(false); setAttributes({});
    router.setParams({
      q: '', city: '', categoryId: '', serviceId: '', verifiedOnly: '', sort: '', radiusKm: '',
      minRating: '', minPrice: '', maxPrice: '', minExperience: '', availableNow: '', attributes: '',
    });
  };
  const clearFilter = (key: string) => {
    if (key === 'categoryId') { setCategoryId(undefined); setServiceId(undefined); router.setParams({ categoryId: '', serviceId: '' }); }
    if (key === 'serviceId') { setServiceId(undefined); router.setParams({ serviceId: '' }); }
    if (key === 'verifiedOnly') { setVerifiedOnly(false); router.setParams({ verifiedOnly: '' }); }
    if (key === 'radiusKm') { setRadiusKm('15'); router.setParams({ radiusKm: '' }); }
    if (key === 'minRating') { setMinRating(''); router.setParams({ minRating: '' }); }
    if (key === 'minPrice') { setMinPrice(''); router.setParams({ minPrice: '' }); }
    if (key === 'maxPrice') { setMaxPrice(''); router.setParams({ maxPrice: '' }); }
    if (key === 'minExperience') { setMinExperience(''); router.setParams({ minExperience: '' }); }
    if (key === 'availableNow') { setAvailableNow(false); router.setParams({ availableNow: '' }); }
    if (key.startsWith('attribute:')) {
      const slug = key.slice('attribute:'.length);
      const next = { ...attributes };
      delete next[slug];
      setAttributes(next);
      router.setParams({ attributes: stringifyAttributes(next) ?? '' });
    }
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
        maxPrice: maxPrice || undefined,
      }).filter(([, v]) => v)) as Record<string, string>,
    });
  };

  const filterableAttributes = asCategoryAttributes(categoryAttributes.data);

  return (
    <Screen scroll={false} padded={false} contentStyle={styles.root}>
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={[typography.eyebrow, { color: colors.gold }]}>DISCOVER</Text>
            <Text style={[typography.h1, { color: colors.textOnPrimary }]}>Find your perfect pro</Text>
            <Text style={[typography.small, { color: colors.textOnPrimary, opacity: 0.86 }]}>
              Browse trusted local professionals for any job.
            </Text>
          </View>
          <View style={[styles.heroIcon, { backgroundColor: colors.goldSoft }]}>
            <Sparkles size={22} color={colors.primaryDark} />
          </View>
        </View>
        <View style={styles.searchRow}>
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
            icon={<SlidersHorizontal size={20} color={colors.primaryDark} />}
            label="Filters"
            variant="surface"
            size={52}
            onPress={() => setShowFilters(true)}
            badgeCount={activeFilterCount || undefined}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/location')} style={[styles.locationPill, { borderColor: colors.goldSoft }]}>
          <MapPin size={14} color={colors.gold} />
          <Text style={[typography.caption, { color: colors.textOnPrimary, flex: 1 }]} numberOfLines={1}>
            {locationLabel}
          </Text>
          <Text style={[typography.caption, { color: colors.gold, fontWeight: '600' }]}>Change</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORTS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={sort === option.value}
              onPress={() => { setSort(option.value); router.setParams({ sort: option.value !== 'recommended' ? option.value : '' }); }}
            />
          ))}
        </ScrollView>
        <View style={styles.actionRow}>
          <View style={styles.viewToggle}>
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
      </View>

      <View style={styles.resultStrip}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>RESULTS</Text>
          <Text style={[typography.h3, { color: colors.text }]}>
            {results.data ? `${results.data.total} professional${results.data.total === 1 ? '' : 's'} found` : 'Searching…'}
          </Text>
        </View>
        {!selectedLocation ? (
          <Pressable accessibilityRole="button" onPress={() => void applyLocation()} style={styles.locationAction}>
            <Navigation size={14} color={colors.primaryDark} />
            <Text style={[typography.caption, { color: colors.primaryDark, fontWeight: '600' }]}>Use my location</Text>
          </Pressable>
        ) : (
          <Text style={[typography.caption, { color: colors.textMuted }]}>Within {radiusKm} km</Text>
        )}
      </View>

      {activeChips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilters}>
          {activeChips.map((chip) => (
            <Chip key={chip.key} label={`${chip.label} ×`} selected onPress={() => clearFilter(chip.key)} tone="neutral" />
          ))}
        </ScrollView>
      ) : null}
      {notice ? <Text style={[styles.notice, typography.caption, { color: colors.primaryDark }]}>{notice}</Text> : null}

      {results.isError ? (
        <View style={styles.errorWrap}>
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={results.isFetching && !results.isLoading} onRefresh={() => void results.refetch()} tintColor={colors.primary} />}
        >
          {results.isLoading ? (
            <ListSkeleton rows={4} />
          ) : results.data?.items.length ? (
            results.data.items.map((provider) => {
              const selected = compareIds.includes(provider.id);
              return (
                <View key={provider.id} style={styles.resultItem}>
                  <ProviderCard
                    provider={provider}
                    onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Add ${provider.businessName} to compare`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleCompare(provider.id)}
                    style={[styles.compareToggle, {
                      backgroundColor: selected ? colors.primarySoft : colors.surfaceAlt,
                      borderColor: selected ? colors.primary : colors.border,
                    }]}
                  >
                    {selected ? <Check size={14} color={colors.primaryDark} /> : <Scale size={14} color={colors.textMuted} />}
                    <Text style={[typography.caption, { color: selected ? colors.primaryDark : colors.textMuted, fontWeight: '600' }]}>
                      {selected ? 'Added to compare' : 'Add to compare'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <EmptyState
              title="No professionals found"
              message="Try a broader search, a larger radius, or clearing filters."
              actionLabel="Clear filters"
              onAction={clearAll}
            />
          )}
        </ScrollView>
      )}

      {compareIds.length ? (
        <View style={[styles.compareBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>COMPARE</Text>
            <Text style={[typography.caption, { color: colors.text }]}>
              {compareIds.length} provider{compareIds.length === 1 ? '' : 's'} selected
            </Text>
          </View>
          <Button
            label="Compare now"
            icon={<Check size={16} color={colors.white} />}
            disabled={compareIds.length < 2}
            onPress={() => router.push({ pathname: '/compare', params: { ids: compareIds.join(',') } })}
          />
        </View>
      ) : null}

      <BottomSheet
        visible={showFilters}
        title="Filters"
        onClose={() => setShowFilters(false)}
        footer={
          <Button
            label="Show results"
            onPress={() => { syncParams({}); setShowFilters(false); }}
            fullWidth
          />
        }
      >
        <View style={styles.sheetContent}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            Narrow your results by category, location, price, and provider details.
          </Text>
          <View style={styles.filterSection}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetChips}>
              <Chip label="Any" selected={!categoryId} onPress={() => { setCategoryId(undefined); setServiceId(undefined); }} />
              {categories.data?.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => { setCategoryId(c.id === categoryId ? undefined : c.id); setServiceId(undefined); }} />
              ))}
            </ScrollView>
          </View>
          {categoryId && services.data?.length ? (
            <View style={styles.filterSection}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>SERVICE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetChips}>
                <Chip label="Any" selected={!serviceId} onPress={() => setServiceId(undefined)} />
                {services.data.map((s) => (
                  <Chip key={s.id} label={s.name} selected={serviceId === s.id} onPress={() => setServiceId(serviceId === s.id ? undefined : s.id)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.filterSection}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>SEARCH RANGE</Text>
            <View style={styles.filterGrid}>
              <View style={styles.filterField}><Input label="Radius (km)" value={radiusKm} onChangeText={setRadiusKm} keyboardType="numeric" placeholder="15" /></View>
              <View style={styles.filterField}><Input label="Min rating" value={minRating} onChangeText={setMinRating} keyboardType="numeric" placeholder="4" /></View>
              <View style={styles.filterField}><Input label="Min price" value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" placeholder="0" /></View>
              <View style={styles.filterField}><Input label="Max price" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="Any" /></View>
              <View style={styles.filterField}><Input label="Min years exp." value={minExperience} onChangeText={setMinExperience} keyboardType="numeric" placeholder="0" /></View>
            </View>
          </View>
          <View style={styles.filterSection}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>AVAILABILITY</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verifiedOnly }} onPress={() => setVerifiedOnly((v) => !v)} style={styles.checkRow}>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Verified providers only</Text>
              <View style={[styles.checkbox, { backgroundColor: verifiedOnly ? colors.primary : colors.surfaceAlt, borderColor: colors.border }]} />
            </Pressable>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: availableNow }} onPress={() => setAvailableNow((v) => !v)} style={styles.checkRow}>
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>Available now</Text>
              <View style={[styles.checkbox, { backgroundColor: availableNow ? colors.primary : colors.surfaceAlt, borderColor: colors.border }]} />
            </Pressable>
          </View>
          {categoryId && filterableAttributes.length ? (
            <View style={styles.filterSection}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>ATTRIBUTES</Text>
              {filterableAttributes.map((attribute) => (
                <AttributeFilterInput
                  key={attribute.id}
                  attribute={attribute}
                  value={attributes[attribute.slug]}
                  onChange={(value) => {
                    const next = { ...attributes };
                    if (value === undefined) delete next[attribute.slug];
                    else next[attribute.slug] = value;
                    setAttributes(next);
                  }}
                />
              ))}
            </View>
          ) : null}
          <Button label="Clear filters" variant="ghost" onPress={clearAll} />
        </View>
      </BottomSheet>

      <BottomSheet visible={showAi} title="AI search" onClose={() => setShowAi(false)}>
        <View style={styles.sheetContent}>
          <View style={[styles.aiIntro, { backgroundColor: colors.primarySoft }]}>
            <Sparkles size={18} color={colors.primaryDark} />
            <Text style={[typography.caption, { color: colors.primaryDark, flex: 1 }]}>
              Describe what you need in plain language. AI processing is used to interpret your request.
            </Text>
          </View>
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
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  heroCopy: { flex: 1, gap: spacing.xs },
  heroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  toolbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.md },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  viewToggle: { width: 176 },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resultStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  locationAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  activeFilters: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexGrow: 0 },
  notice: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  errorWrap: { padding: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  resultItem: { gap: spacing.xs },
  compareToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  map: { flex: 1, marginHorizontal: spacing.lg, marginBottom: spacing.lg, borderRadius: radius.lg },
  compareBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sheetContent: { gap: spacing.lg },
  sheetChips: { gap: spacing.sm, paddingRight: spacing.md },
  filterSection: { gap: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1 },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  filterField: { width: '47%' },
  attributeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attributeBlock: { gap: spacing.sm },
  attributeChips: { gap: spacing.sm, flexGrow: 0 },
  aiIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
});
