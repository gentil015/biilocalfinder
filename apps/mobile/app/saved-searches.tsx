import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import { parityCustomerApi, type SavedSearch } from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { formatDate } from '@/src/utils/format';

type CategoryOption = { id: string; name: string };

const browseRoute: Href = '/explore';

function paramValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function flattenCategories(categories: Array<CategoryOption & { children?: CategoryOption[] | null }>): CategoryOption[] {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name },
    ...flattenCategories(category.children ?? []),
  ]);
}

export default function SavedSearchesScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const params = useLocalSearchParams<{
    name?: string;
    q?: string;
    city?: string;
    categoryId?: string;
    serviceId?: string;
    verifiedOnly?: string;
    maxPrice?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [name, setName] = useState(paramValue(params.name) || paramValue(params.q));
  const [categoryId, setCategoryId] = useState(paramValue(params.categoryId));
  const [serviceId, setServiceId] = useState(paramValue(params.serviceId));
  const [city, setCity] = useState(paramValue(params.city));
  const [verifiedOnly, setVerifiedOnly] = useState(paramValue(params.verifiedOnly) === 'true');
  const [maxPrice, setMaxPrice] = useState(paramValue(params.maxPrice));
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedSearch | null>(null);

  const saved = useQuery({ queryKey: ['saved-searches'], queryFn: () => parityCustomerApi.savedSearches() });
  const categories = useQuery({ queryKey: ['saved-searches', 'categories'], queryFn: () => discoveryApi.categories() });
  const services = useQuery({
    queryKey: ['saved-searches', 'services', categoryId],
    queryFn: () => discoveryApi.services(categoryId || undefined),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
  };

  const create = useMutation({
    mutationFn: () =>
      parityCustomerApi.createSavedSearch({
        name: name.trim(),
        categoryId: categoryId || undefined,
        serviceId: serviceId || undefined,
        city: city.trim() || undefined,
        verifiedOnly,
        maxPrice: maxPrice && Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : undefined,
      }),
    onSuccess: async () => {
      setName('');
      setCategoryId('');
      setServiceId('');
      setCity('');
      setVerifiedOnly(false);
      setMaxPrice('');
      setNotice({ message: 'Search saved.', tone: 'success' });
      showToast('Search saved.', 'success');
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => parityCustomerApi.deleteSavedSearch(id),
    onSuccess: async () => {
      setPendingDelete(null);
      showToast('Saved search removed.', 'success');
      await invalidate();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const submit = () => {
    if (name.trim().length < 2) {
      setNotice({ message: 'Give this search a name.', tone: 'error' });
      return;
    }
    if (!categoryId && !serviceId && !city.trim()) {
      setNotice({ message: 'Add at least a category, service, or city.', tone: 'error' });
      return;
    }
    setNotice(null);
    create.mutate();
  };

  const rerun = (search: SavedSearch) => {
    const q = search.service?.name ?? search.category?.name ?? search.city ?? '';
    router.push({
      pathname: '/explore',
      params: {
        q: q || undefined,
        categoryId: search.categoryId ?? '',
        serviceId: search.serviceId ?? '',
        verifiedOnly: search.verifiedOnly ? 'true' : 'false',
        maxPrice: search.maxPrice ? String(search.maxPrice) : undefined,
      },
    });
  };

  const categoryOptions = categories.data ? flattenCategories(categories.data) : [];

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Saved searches"
        eyebrow="Explore shortcuts"
        subtitle="Prefilled from the filters you were using"
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      <Card>
        <SectionHeader title="Save a search" subtitle="Get notified when a new provider matches." />
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Plumbers in Kigali" />
        {categories.isError ? (
          <ErrorState message="Categories could not be loaded." onRetry={() => void categories.refetch()} />
        ) : categories.isPending ? (
          <Skeleton height={40} />
        ) : categoryOptions.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Any" selected={!categoryId} onPress={() => { setCategoryId(''); setServiceId(''); }} />
              {categoryOptions.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  selected={categoryId === category.id}
                  onPress={() => { setCategoryId(category.id); setServiceId(''); }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {categoryId ? (
          services.isError ? (
            <ErrorState message="Services could not be loaded." onRetry={() => void services.refetch()} />
          ) : services.isPending ? (
            <Skeleton height={40} />
          ) : services.data?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="Any" selected={!serviceId} onPress={() => setServiceId('')} />
                {services.data.map((service) => (
                  <Chip
                    key={service.id}
                    label={service.name}
                    selected={serviceId === service.id}
                    onPress={() => setServiceId(service.id)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : (
            <Notice message="No services for this category." tone="info" />
          )
        ) : null}
        <Input label="City (optional)" value={city} onChangeText={setCity} placeholder="Kigali" />
        <Input label="Max price (optional)" value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" placeholder="Any price" />
        <View style={styles.switchRow}>
          <Text style={[typography.small, { color: colors.textSecondary }]}>Verified providers only</Text>
          <Switch
            value={verifiedOnly}
            accessibilityLabel="Verified providers only"
            onValueChange={setVerifiedOnly}
          />
        </View>
        <Button label="Save search" onPress={submit} loading={create.isPending} fullWidth />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Your saved searches" subtitle="Re-run a search or remove it when it is no longer useful." />
        {saved.isError ? (
          <ErrorState message="Saved searches could not be loaded." onRetry={() => void saved.refetch()} />
        ) : saved.isPending ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : saved.data?.length ? (
          saved.data.map((search) => {
            const facets = [search.category?.name, search.service?.name, search.city, search.verifiedOnly ? 'Verified only' : null].filter(Boolean);
            const deleting = remove.isPending && remove.variables === search.id;
            return (
              <Card key={search.id} variant="elevated">
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{search.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{facets.join(' · ') || 'All providers'}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(search.createdAt)}</Text>
                <View style={styles.actions}>
                  <Badge label={search.maxPrice ? `Up to ${search.maxPrice}` : 'Any price'} />
                  <Button label="Re-run" variant="secondary" size="sm" onPress={() => rerun(search)} />
                  <Button
                    label="Delete"
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} color={colors.white} />}
                    loading={deleting}
                    onPress={() => setPendingDelete(search)}
                  />
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon={<Bookmark size={24} color={colors.primary} />}
            title="No saved searches yet"
            message="Save a search above and it will appear here for quick re-runs."
            actionLabel="Browse providers"
            onAction={() => router.push(browseRoute)}
          />
        )}
      </View>

      <ConfirmDialog
        visible={Boolean(pendingDelete)}
        title="Delete saved search?"
        message={`"${pendingDelete?.name ?? ''}" will be removed from your saved searches.`}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
