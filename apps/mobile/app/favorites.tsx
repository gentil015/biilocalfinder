import { Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { ProviderCard } from '@/src/components/domain/ProviderCard';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useFavorites } from '@/src/hooks/queries';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const favorites = useFavorites();

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Favorites"
        eyebrow="Saved providers"
        subtitle={favorites.data?.length ? `${favorites.data.length} saved` : 'Providers you want to revisit'}
      />
      {favorites.isError ? (
        <ErrorState message="Favorites could not be loaded." onRetry={() => void favorites.refetch()} />
      ) : favorites.isPending ? (
        <ListSkeleton rows={4} />
      ) : favorites.data?.length ? (
        <View style={{ gap: spacing.md }}>
          {favorites.data.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Heart size={28} color={colors.primary} />}
          title="No favorites yet"
          message="Tap the heart on a provider profile to save them here."
          actionLabel="Browse providers"
          onAction={() => router.push('/(customer)/(tabs)/explore')}
        />
      )}
    </Screen>
  );
}
