import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Circle,
  Film,
  GraduationCap,
  ImagePlus,
  Images,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { IconButton } from '@/src/components/ui/IconButton';
import { Input } from '@/src/components/ui/Input';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { useOfferings } from '@/src/hooks/queries';
import { filesApi } from '@/src/services/api/endpoints/files';
import {
  parityProviderApi,
  type CreatePortfolioDto,
  type PortfolioImage,
  type PortfolioItem,
  type UpdatePortfolioDto,
} from '@/src/services/api/endpoints/parity-provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

const PORTFOLIOS_KEY = ['provider', 'parity', 'portfolios'] as const;

interface MediaUpload {
  portfolioId: string;
  assets: ImagePickerAsset[];
  kind: 'IMAGE' | 'VIDEO';
  pair: boolean;
}

interface ProjectErrors {
  title?: string;
  projectDate?: string;
}

type PendingDelete =
  | { kind: 'project'; id: string; title: string }
  | { kind: 'image'; id: string; mediaType: 'IMAGE' | 'VIDEO' };

function toFile(asset: ImagePickerAsset, kind: 'IMAGE' | 'VIDEO') {
  return {
    uri: asset.uri,
    name: asset.fileName ?? undefined,
    type: asset.mimeType ?? (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
  };
}

function groupMedia(images: PortfolioImage[]) {
  const pairs = new Map<string, PortfolioImage[]>();
  for (const image of images) {
    if (!image.beforeAfterGroup || !image.beforeAfterRole) continue;
    const group = pairs.get(image.beforeAfterGroup) ?? [];
    group.push(image);
    pairs.set(image.beforeAfterGroup, group);
  }
  const pairedIds = new Set<string>();
  const groups = Array.from(pairs.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const ordered = group
        .slice()
        .sort((a, b) => (a.beforeAfterRole === 'BEFORE' ? -1 : 1) - (b.beforeAfterRole === 'BEFORE' ? -1 : 1));
      ordered.forEach((image) => pairedIds.add(image.id));
      return ordered;
    });
  return { groups, singles: images.filter((image) => !pairedIds.has(image.id)) };
}

export default function ProviderPortfolioScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { colors } = theme;
  const { showToast } = useToast();
  const portfolios = useQuery({ queryKey: PORTFOLIOS_KEY, queryFn: () => parityProviderApi.portfolios() });
  const offerings = useOfferings();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [projectDate, setProjectDate] = useState('');
  const [errors, setErrors] = useState<ProjectErrors>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editProjectDate, setEditProjectDate] = useState('');
  const [editPair, setEditPair] = useState(false);
  const [editErrors, setEditErrors] = useState<ProjectErrors>({});
  const [pairPortfolioId, setPairPortfolioId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: PORTFOLIOS_KEY });

  const create = useMutation({
    mutationFn: (dto: CreatePortfolioDto) => parityProviderApi.createPortfolio(dto),
    onSuccess: async () => {
      await invalidate();
      setTitle('');
      setDescription('');
      setServiceId('');
      setProjectDate('');
      setNotice(null);
      showToast('Project added to your portfolio.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePortfolioDto }) => parityProviderApi.updatePortfolio(id, dto),
    onSuccess: async () => {
      await invalidate();
      setEditingId(null);
      setNotice(null);
      showToast('Project updated.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => parityProviderApi.deletePortfolio(id),
    onSuccess: async () => {
      await invalidate();
      setNotice(null);
      showToast('Project removed.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const upload = useMutation({
    mutationFn: async ({ portfolioId, assets, kind, pair }: MediaUpload) => {
      const group = pair && assets.length === 2 ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
      for (const [index, asset] of assets.entries()) {
        const uploaded =
          kind === 'VIDEO'
            ? await filesApi.uploadVideo(toFile(asset, kind))
            : await filesApi.uploadImage(toFile(asset, kind));
        await parityProviderApi.addPortfolioImage(portfolioId, {
          url: uploaded.url,
          storageKey: uploaded.key,
          mediaType: kind,
          beforeAfterRole: group ? (index === 0 ? 'BEFORE' : 'AFTER') : undefined,
          beforeAfterGroup: group,
        });
      }
    },
    onSuccess: async () => {
      await invalidate();
      setPairPortfolioId(null);
      setNotice(null);
      showToast('Media added to your portfolio.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const removeImage = useMutation({
    mutationFn: (id: string) => parityProviderApi.deletePortfolioImage(id),
    onSuccess: async () => {
      await invalidate();
      setNotice(null);
      showToast('Media removed.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const submit = () => {
    const name = title.trim();
    const date = projectDate.trim();
    const nextErrors: ProjectErrors = {};
    if (name.length === 0) nextErrors.title = 'Give the project a title.';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.projectDate = 'Use YYYY-MM-DD for dates.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({ message: 'Check the highlighted fields before adding this project.', tone: 'warning' });
      return;
    }
    create.mutate({
      title: name,
      description: description.trim() || undefined,
      serviceId: serviceId || undefined,
      projectDate: date || undefined,
    });
  };

  const openEdit = (project: PortfolioItem) => {
    setEditingId(project.id);
    setEditTitle(project.title ?? '');
    setEditDescription(project.description ?? '');
    setEditServiceId(project.service?.id ?? (project as { serviceId?: string | null }).serviceId ?? '');
    setEditProjectDate(project.projectDate ? project.projectDate.slice(0, 10) : '');
    setEditPair(pairPortfolioId === project.id || project.images.some((image) => Boolean(image.beforeAfterRole)));
    setEditErrors({});
    setNotice(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditErrors({});
  };

  const submitEdit = () => {
    if (!editingId) return;
    const name = editTitle.trim();
    const date = editProjectDate.trim();
    const nextErrors: ProjectErrors = {};
    if (name.length === 0) nextErrors.title = 'Give the project a title.';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.projectDate = 'Use YYYY-MM-DD for dates.';
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setPairPortfolioId((current) => (editPair ? editingId : current === editingId ? null : current));
    update.mutate({
      id: editingId,
      dto: {
        title: name,
        description: editDescription.trim(),
        serviceId: editServiceId || undefined,
        projectDate: date || undefined,
      },
    });
  };

  const pickMedia = async (portfolioId: string, kind: 'IMAGE' | 'VIDEO', pair: boolean) => {
    if (pair && kind === 'IMAGE') {
      setNotice({ message: 'Choose exactly 2 photos to create a before/after pair.', tone: 'info' });
    } else {
      setNotice(null);
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'VIDEO' ? ['videos'] : ['images'],
        allowsMultipleSelection: kind === 'IMAGE',
        selectionLimit: kind === 'VIDEO' ? 1 : pair ? 2 : 5,
        quality: kind === 'VIDEO' ? undefined : 0.7,
      });
      if (result.canceled || result.assets.length === 0) return;
      if (kind === 'VIDEO' && result.assets.length !== 1) {
        setNotice({ message: 'Choose one video at a time.', tone: 'warning' });
        return;
      }
      if (pair && result.assets.length !== 2) {
        setNotice({ message: 'A before/after pair needs exactly 2 photos.', tone: 'warning' });
        return;
      }
      upload.mutate({ portfolioId, assets: result.assets, kind, pair: pair && kind === 'IMAGE' });
    } catch (error) {
      setNotice({ message: toApiError(error).message, tone: 'error' });
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    if (target.kind === 'project') remove.mutate(target.id);
    else removeImage.mutate(target.id);
  };

  const projects = portfolios.data ?? [];
  const offeringsData = offerings.data ?? [];

  const renderMedia = (image: PortfolioImage, showRemove = true) => (
    <View key={image.id} style={styles.mediaWrap}>
      {image.mediaType === 'IMAGE' ? (
        <Image source={{ uri: image.url }} style={styles.media} contentFit="cover" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.media, { backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }]}>
          <Film size={24} color={colors.textMuted} />
        </View>
      )}
      {image.beforeAfterRole ? <Badge label={image.beforeAfterRole === 'BEFORE' ? 'Before' : 'After'} tone="accent" /> : null}
      {showRemove ? (
        <IconButton
          icon={<Trash2 size={12} />}
          label="Remove media"
          variant="ghost"
          tone="danger"
          size={theme.hit.compact}
          disabled={removeImage.isPending}
          onPress={() => setPendingDelete({ kind: 'image', id: image.id, mediaType: image.mediaType })}
        />
      ) : null}
    </View>
  );

  return (
    <Screen
      contentStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      refreshControl={
        <RefreshControl refreshing={portfolios.isFetching} onRefresh={() => void portfolios.refetch()} />
      }
    >
      <AppScreenHeader eyebrow="Provider tools" title="Portfolio" subtitle="Show clients your real work" />

      <Card variant="elevated">
        <View style={styles.formGroup}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>PROJECT DETAILS</Text>
          <Input
            label="Project title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Kitchen renovation"
            error={errors.title}
          />
          <Input
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What did the job involve?"
            multiline
            numberOfLines={3}
          />
        </View>
        <View style={styles.formGroup}>
          <Text style={[typography.eyebrow, { color: colors.primary }]}>DATE AND SERVICE</Text>
          <Input
            label="Project date"
            value={projectDate}
            onChangeText={setProjectDate}
            placeholder="YYYY-MM-DD"
            hint="Optional · use YYYY-MM-DD"
            error={errors.projectDate}
          />
          {offeringsData.length ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
                <Chip
                  label="No service"
                  tone="neutral"
                  selected={serviceId === ''}
                  onPress={() => setServiceId('')}
                />
                {offeringsData.map((offering) => {
                  const value = offering.service?.id ?? offering.serviceId;
                  return (
                    <Chip
                      key={offering.id}
                      label={offering.title ?? offering.service?.name ?? 'Service'}
                      selected={serviceId === offering.serviceId || serviceId === value}
                      onPress={() => setServiceId(value)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
        <Button label="Add project" onPress={submit} loading={create.isPending} fullWidth />
      </Card>

      <Notice message={notice?.message ?? null} tone={notice?.tone ?? 'info'} />

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeader title="Your projects" subtitle={`${projects.length} projects`} />
        {portfolios.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="70%" height={12} />
            </Card>
            <Card variant="muted">
              <Skeleton height={18} />
              <Skeleton width="55%" height={12} />
            </Card>
          </View>
        ) : null}
        {portfolios.isError ? (
          <ErrorState message="Your portfolio could not be loaded." onRetry={() => void portfolios.refetch()} />
        ) : null}
        {portfolios.isSuccess && projects.length === 0 ? (
          <EmptyState
            icon={<ImagePlus size={24} color={colors.primaryDark} />}
            title="No portfolio projects yet"
            message="Add a project above, then attach photos or videos of your work."
          />
        ) : null}
        {projects.map((project) => {
          const pairMode = pairPortfolioId === project.id;
          const uploading = upload.isPending && upload.variables?.portfolioId === project.id;
          const media = groupMedia(project.images);
          return (
            <Card key={project.id} variant="default">
              <View style={{ gap: theme.spacing.md }}>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: theme.spacing.xs }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>{project.title}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {[project.service?.name, project.projectDate].filter(Boolean).join(' · ') || 'No service or date'}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <IconButton
                      icon={<Pencil size={18} />}
                      label={`Edit ${project.title}`}
                      variant="ghost"
                      size={theme.hit.compact}
                      disabled={update.isPending}
                      onPress={() => openEdit(project)}
                    />
                    <IconButton
                      icon={<Trash2 size={18} />}
                      label={`Delete ${project.title}`}
                      variant="ghost"
                      tone="danger"
                      size={theme.hit.compact}
                      disabled={remove.isPending}
                      onPress={() => setPendingDelete({ kind: 'project', id: project.id, title: project.title })}
                    />
                  </View>
                </View>
                {project.description ? (
                  <Text style={[typography.small, { color: colors.textSecondary }]}>{project.description}</Text>
                ) : null}
                {media.groups.map((group, index) => (
                  <View key={`${group[0]?.beforeAfterGroup ?? index}`} style={styles.beforeAfter}>
                    {group.map((image, imageIndex) => (
                      <View key={image.id} style={styles.beforeAfterItem}>
                        {imageIndex > 0 ? <ArrowRight size={16} color={colors.primaryDark} /> : null}
                        {renderMedia(image)}
                      </View>
                    ))}
                  </View>
                ))}
                {media.singles.length ? (
                  <View style={styles.grid}>{media.singles.map((image) => renderMedia(image))}</View>
                ) : null}
                <Chip
                  label="Next 2 photos are a before/after pair"
                  tone="neutral"
                  selected={pairMode}
                  icon={pairMode ? <Check size={16} /> : <Circle size={16} />}
                  onPress={() => setPairPortfolioId(pairMode ? null : project.id)}
                />
                <View style={styles.actions}>
                  <Button
                    label="Add photos"
                    variant="secondary"
                    size="sm"
                    loading={uploading}
                    disabled={upload.isPending && !uploading}
                    onPress={() => void pickMedia(project.id, 'IMAGE', pairMode)}
                  />
                  <Button
                    label="Add video"
                    variant="secondary"
                    size="sm"
                    loading={uploading}
                    disabled={upload.isPending && !uploading}
                    onPress={() => void pickMedia(project.id, 'VIDEO', false)}
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <Card variant="muted">
        <SectionHeader title="More provider tools" />
        <MenuRow
          icon={<MapPin size={18} color={colors.primaryDark} />}
          label="Service areas"
          onPress={() => router.push('/provider/service-areas')}
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
          icon={<Images size={18} color={colors.primaryDark} />}
          label="Insights"
          onPress={() => router.push('/provider/insights')}
        />
      </Card>

      <BottomSheet
        visible={editingId !== null}
        title="Edit project"
        onClose={closeEdit}
        footer={<Button label="Save changes" onPress={submitEdit} loading={update.isPending} fullWidth />}
      >
        <View style={{ gap: theme.spacing.md }}>
          <Input
            label="Project title"
            value={editTitle}
            onChangeText={setEditTitle}
            error={editErrors.title}
          />
          <Input
            label="Description"
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="What did the job involve?"
            multiline
            numberOfLines={3}
          />
          <Input
            label="Project date"
            value={editProjectDate}
            onChangeText={setEditProjectDate}
            placeholder="YYYY-MM-DD"
            hint="Optional · use YYYY-MM-DD"
            error={editErrors.projectDate}
          />
          {offeringsData.length ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
                <Chip
                  label="No change"
                  tone="neutral"
                  selected={editServiceId === ''}
                  onPress={() => setEditServiceId('')}
                />
                {offeringsData.map((offering) => {
                  const value = offering.service?.id ?? offering.serviceId;
                  return (
                    <Chip
                      key={offering.id}
                      label={offering.title ?? offering.service?.name ?? 'Service'}
                      selected={editServiceId === value}
                      onPress={() => setEditServiceId(value)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
              Next 2 photos are a before/after pair
            </Text>
            <Switch
              value={editPair}
              accessibilityLabel="Next 2 photos are a before/after pair"
              onValueChange={setEditPair}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.white}
            />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            This applies to the next photos you add, not to media already uploaded.
          </Text>
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={Boolean(pendingDelete)}
        title={pendingDelete?.kind === 'image' ? 'Remove this media?' : 'Delete this project?'}
        message={
          pendingDelete?.kind === 'image'
            ? 'This media will be removed from the project. The project itself stays.'
            : `${pendingDelete?.title ?? 'This project'} and its media will be removed.`
        }
        confirmLabel={pendingDelete?.kind === 'image' ? 'Remove media' : 'Delete project'}
        destructive
        loading={pendingDelete?.kind === 'image' ? removeImage.isPending : remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formGroup: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mediaWrap: { position: 'relative', alignItems: 'flex-start', gap: spacing.xs },
  media: { width: 72, height: 72, borderRadius: radius.md },
  beforeAfter: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  beforeAfterItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
