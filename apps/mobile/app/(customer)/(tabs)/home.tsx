import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronRight, MapPin, Sparkles, Wrench } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProviderCard } from '@/src/components/domain/ProviderCard';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { IconButton } from '@/src/components/ui/IconButton';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { SearchBar } from '@/src/components/ui/SearchBar';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useCategories, usePersonalization, useProviderSearch } from '@/src/hooks/queries';
import { queryKeys } from '@/src/hooks/queries';
import { useAppStore } from '@/src/stores/app.store';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

type SectionProvider = { id: string; businessName?: string };

export default function CustomerHomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const selectedLocation = useAppStore((state) => state.selectedLocation);
  const [search, setSearch] = useState('');
  const lat = selectedLocation?.latitude;
  const lng = selectedLocation?.longitude;
  const locationParams = lat !== undefined && lng !== undefined ? { lat, lng } : {};
  const categories = useCategories();
  const personalization = usePersonalization(lat, lng);
  const featured = useProviderSearch({ ...locationParams, sort: 'highest_rated', limit: 5 });
  const nearby = useProviderSearch(lat !== undefined && lng !== undefined ? { lat, lng, sort: 'nearest', limit: 5 } : { sort: 'recommended', limit: 5 });
  const refreshing = categories.isFetching || personalization.isFetching || featured.isFetching || nearby.isFetching;

  const refresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
      queryClient.invalidateQueries({ queryKey: queryKeys.personalization(lat, lng) }),
      queryClient.invalidateQueries({ queryKey: ['providers', 'search'] }),
    ]);
  };

  const submitSearch = () => {
    const q = search.trim();
    router.push({ pathname: '/explore', params: q ? { q } : {} });
  };

  const personalizedSections = useMemo(() => {
    const sections = personalization.data?.sections;
    if (!sections || typeof sections !== 'object') return [] as Array<{ key: string; title: string; items: SectionProvider[] }>;
    return Object.entries(sections)
      .map(([key, value]) => {
        if (!Array.isArray(value)) return null;
        const items = value.filter((item): item is SectionProvider => Boolean(item && typeof item === 'object' && 'id' in item));
        if (!items.length) return null;
        const title = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        return { key, title: title.charAt(0).toUpperCase() + title.slice(1), items: items.slice(0, 5) };
      })
      .filter((s): s is { key: string; title: string; items: SectionProvider[] } => Boolean(s))
      .slice(0, 2);
  }, [personalization.data?.sections]);

  return (
    <Screen
      contentStyle={styles.content}
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={[styles.hero, { backgroundColor: colors.primary }]}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[typography.eyebrow, { color: colors.gold }]}>{selectedLocation?.city ?? 'BII LOCALFINDER'}</Text>
            <Text style={[typography.h1, { color: colors.textOnPrimary }]}>
              {personalization.data?.greeting ?? `Hello, ${user?.firstName ?? 'there'}`}
            </Text>
            <Text style={[typography.body, { color: colors.textOnPrimary, opacity: 0.82 }]}>
              Find trusted local professionals, compare quotes, and book with confidence.
            </Text>
          </View>
          <IconButton
            icon={<Bell size={20} />}
            label="Notifications"
            variant="surface"
            onPress={() => router.push('/notifications')}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change location"
          onPress={() => router.push('/location')}
          style={[styles.location, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MapPin size={16} color={colors.gold} />
          <Text style={[typography.small, { color: colors.text, flex: 1 }]} numberOfLines={1}>
            {selectedLocation?.label ?? 'Set your location for nearby professionals'}
          </Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="What service do you need?"
          onSubmitEditing={submitSearch}
          onClear={() => setSearch('')}
        />
      </View>

      <View>
        <SectionHeader
          title="Browse categories"
          subtitle="Start with a service type"
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/explore')}>
              <Text style={[typography.small, { color: colors.primaryDark, fontWeight: '600' }]}>Explore</Text>
            </Pressable>
          }
        />
        {categories.isError ? (
          <ErrorState message="Categories could not be loaded." onRetry={refresh} />
        ) : categories.isLoading ? (
          <View style={styles.categories}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.category, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} />
            ))}
          </View>
        ) : categories.data?.length ? (
          <View style={styles.categories}>
            {categories.data.slice(0, 8).map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${category.name}`}
                onPress={() => router.push({ pathname: '/explore', params: { categoryId: category.id } })}
                style={[styles.category, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: colors.primarySoft }]}>
                  <Wrench size={18} color={colors.primaryDark} />
                </View>
                <Text style={[typography.caption, { color: colors.text, textAlign: 'center' }]} numberOfLines={2}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="No categories yet" message="The service catalogue is being prepared." />
        )}
      </View>

      {personalizedSections.map((section) => (
        <View key={section.key}>
          <SectionHeader title={section.title} subtitle="Based on your activity" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
            {section.items.map((item) => (
              <Card
                key={item.id}
                onPress={() => router.push({ pathname: '/provider/[id]', params: { id: item.id } })}
                style={styles.miniCard}
              >
                <Sparkles size={16} color={colors.primary} />
                <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>{item.businessName ?? 'Provider'}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>View profile</Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      ))}

      <View>
        <SectionHeader
          title={selectedLocation ? 'Nearby professionals' : 'Recommended professionals'}
          subtitle={selectedLocation ? 'Close to your selected location' : 'Set a location for nearby matches'}
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push('/explore')}>
              <Text style={[typography.small, { color: colors.primaryDark, fontWeight: '600' }]}>View all</Text>
            </Pressable>
          }
        />
        {nearby.isError ? (
          <ErrorState message="Providers could not be loaded." onRetry={refresh} />
        ) : nearby.isLoading ? (
          <ListSkeleton rows={3} />
        ) : nearby.data?.items.length ? (
          <View style={{ gap: spacing.md }}>
            {nearby.data.items.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No professionals yet"
            message="Try setting a location or browsing another category."
            actionLabel="Set location"
            onAction={() => router.push('/location')}
          />
        )}
      </View>

      <View style={{ paddingBottom: spacing.xxl }}>
        <SectionHeader title="Top rated" subtitle="Highly reviewed by clients" />
        {featured.isError ? (
          <ErrorState message="Top rated professionals could not be loaded." onRetry={refresh} />
        ) : featured.isLoading ? (
          <ListSkeleton rows={2} />
        ) : featured.data?.items.length ? (
          <View style={{ gap: spacing.md }}>
            {featured.data.items.slice(0, 3).map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  hero: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg, padding: spacing.xl, gap: spacing.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { width: '31%', minHeight: 92, borderRadius: radius.md, borderWidth: 1, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  categoryIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  horizontalCards: { gap: spacing.md, paddingVertical: spacing.xs },
  miniCard: { width: 160, gap: spacing.sm },
});
