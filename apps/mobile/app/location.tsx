import { LocateFixed, MapPin, Navigation } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/States';
import { useCurrentLocation } from '@/src/hooks/useLocation';
import { discoveryApi, type GeocodeResult } from '@/src/services/api/endpoints/discovery';
import { toApiError } from '@/src/services/api/errors';
import { useAppStore } from '@/src/stores/app.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

type LocationChoice = Pick<GeocodeResult, 'label' | 'latitude' | 'longitude' | 'city'>;

export default function LocationScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const selected = useAppStore((state) => state.selectedLocation);
  const { location, loading, error, refresh } = useCurrentLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (query.trim().length < 3) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const next = await discoveryApi.geocode(query.trim());
        if (!cancelled) {
          setResults(next);
          setNotice(null);
        }
      } catch (caught) {
        if (!cancelled) setNotice(toApiError(caught).message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const select = async (result: LocationChoice) => {
    await useAppStore.getState().setSelectedLocation({
      label: result.label,
      latitude: result.latitude,
      longitude: result.longitude,
      city: result.city ?? undefined,
    });
    router.back();
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader title="Choose location" eyebrow="Search area" subtitle="Nearby results follow your selected place" />
      <Notice message={error} tone="error" />
      <Notice message={notice} tone="error" />

      {selected ? (
        <Card variant="muted">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MapPin size={16} color={colors.primaryDark} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Selected location</Text>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{selected.label}</Text>
            </View>
            <Badge label="Active" tone="success" />
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Search a place" subtitle="Type at least three characters to see matches." />
        <Input
          placeholder="City or address"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          hint="Kigali, Rubavu, Kamuhoza…"
        />
        <Button
          label={loading ? 'Getting location…' : 'Use my current location'}
          variant="secondary"
          icon={<LocateFixed size={16} color={colors.primaryDark} />}
          loading={loading}
          onPress={() => void refresh()}
        />
      </Card>

      {location ? (
        <Card variant="elevated" onPress={() => void select(location)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Navigation size={16} color={colors.primaryDark} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Detected location</Text>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{location.label}</Text>
            </View>
            <Badge label="Use" tone="accent" />
          </View>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Matches" subtitle={results.length ? `${results.length} places found` : 'Search results appear here'} />
        {searching ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : results.length ? (
          results.map((result, index) => (
            <Card key={`${result.label}-${index}`} onPress={() => void select(result)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <MapPin size={16} color={colors.primary} />
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{result.label}</Text>
                <Badge label="Select" tone="neutral" />
              </View>
            </Card>
          ))
        ) : query.trim().length >= 3 ? (
          <EmptyState title="No matching locations" message="Try a different city or address." />
        ) : (
          <EmptyState title="Find your area" message="Search for a city or address to see providers near you." />
        )}
      </View>
    </Screen>
  );
}
