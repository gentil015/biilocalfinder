import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { ProviderCard } from '@/src/components/domain/ProviderCard';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { queryKeys, useFavorites } from '@/src/hooks/queries';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';

export default function FavoritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const favorites = useFavorites();
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const removeFavorite = useMutation({
    mutationFn: ({ providerId }: { providerId: string; businessName: string }) =>
      discoveryApi.removeFavorite(providerId),
    onSuccess: (_result, { businessName }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
      setNotice({ message: `Removed ${businessName} from favorites.`, tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Favorites"
        eyebrow="Saved providers"
        subtitle={favorites.data?.length ? `${favorites.data.length} saved` : 'Providers you want to revisit'}
      />
      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
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
              isFavorite
              onFavorite={() =>
                removeFavorite.mutate({ providerId: provider.id, businessName: provider.businessName })
              }
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
          onAction={() => router.push('/explore')}
        />
      )}
    </Screen>
  );
}
