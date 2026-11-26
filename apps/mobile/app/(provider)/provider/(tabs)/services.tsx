import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Wrench, X } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';
import { Badge } from '@/src/components/ui/Badges';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { FormInput } from '@/src/components/ui/FormInput';
import { IconButton } from '@/src/components/ui/IconButton';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys, useOfferings, useServices } from '@/src/hooks/queries';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatMoney, humanize } from '@/src/utils/format';
import { offeringFormSchema } from '@/src/utils/validation';
import type { OfferingItem } from '@/src/types/api';

type Values = z.infer<typeof offeringFormSchema>;
type NoticeState = { message: string; tone: NoticeTone } | null;

const priceTypes: Values['priceType'][] = ['FIXED', 'HOURLY', 'PER_DAY', 'STARTING_FROM', 'CUSTOM_QUOTE'];
const emptyValues: Values = { serviceId: '', priceType: 'FIXED', basePrice: '', duration: '' };

function toDto(values: Values) {
  return {
    serviceId: values.serviceId,
    title: values.title || undefined,
    description: values.description || undefined,
    basePrice: values.basePrice === '' || values.basePrice === undefined ? undefined : Number(values.basePrice),
    priceType: values.priceType,
    duration: values.duration || undefined,
  };
}

export default function ProviderServicesScreen() {
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const offerings = useOfferings();
  const services = useServices();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(offeringFormSchema),
    defaultValues: emptyValues,
  });
  const selectedServiceId = watch('serviceId');
  const selectedPriceType = watch('priceType');
  const selectedServiceName = services.data?.find((service) => service.id === selectedServiceId)?.name;

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: queryKeys.offerings });
  const reportError = (error: unknown) => {
    const message = toApiError(error).message;
    setNotice({ message, tone: 'error' });
    showToast(message, 'error');
  };
  const create = useMutation({
    mutationFn: (values: Values) => providerApi.createOffering(toDto(values)),
    onSuccess: async () => {
      await invalidate();
      reset(emptyValues);
      setShowForm(false);
      setNotice({ message: 'Service offering created.', tone: 'success' });
      showToast('Service offering created.', 'success');
    },
    onError: reportError,
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Values }) => providerApi.updateOffering(id, toDto(values)),
    onSuccess: async () => {
      await invalidate();
      reset(emptyValues);
      setEditingId(null);
      setShowForm(false);
      setNotice({ message: 'Service offering updated.', tone: 'success' });
      showToast('Service offering updated.', 'success');
    },
    onError: reportError,
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => providerApi.updateOffering(id, { isActive }),
    onSuccess: async () => {
      await invalidate();
      showToast('Offering visibility updated.', 'success');
    },
    onError: reportError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => providerApi.deleteOffering(id),
    onSuccess: async () => {
      await invalidate();
      setPendingDeleteId(null);
      showToast('Service offering deleted.', 'success');
    },
    onError: reportError,
  });

  const closeForm = () => {
    reset(emptyValues);
    setEditingId(null);
    setShowForm(false);
    setNotice(null);
  };
  const openCreate = () => {
    reset(emptyValues);
    setEditingId(null);
    setNotice(null);
    setShowForm(true);
  };
  const openEdit = (offering: OfferingItem) => {
    reset({
      serviceId: offering.serviceId,
      title: offering.title ?? '',
      description: offering.description ?? '',
      basePrice: offering.basePrice !== null && offering.basePrice !== undefined ? String(offering.basePrice) : '',
      priceType: (priceTypes as string[]).includes(String(offering.priceType))
        ? (offering.priceType as Values['priceType'])
        : 'FIXED',
      duration: offering.duration !== null && offering.duration !== undefined ? String(offering.duration) : '',
    });
    setEditingId(offering.id);
    setNotice(null);
    setShowForm(true);
  };
  const submit = handleSubmit((values) => {
    if (editingId) update.mutate({ id: editingId, values });
    else create.mutate(values);
  });
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}>
      <AppScreenHeader
        eyebrow="Offerings"
        title="Services"
        subtitle="Manage what clients can request"
        back={false}
        large
        action={
          <IconButton
            icon={showForm ? <X size={20} /> : <Plus size={20} />}
            label={showForm ? 'Close offering form' : 'Add service'}
            variant="primary"
            size={hit.min}
            onPress={() => (showForm ? closeForm() : openCreate())}
          />
        }
      />

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
      {errors.serviceId?.message ? <Notice message={errors.serviceId.message} tone="error" /> : null}

      <View>
        <SectionHeader title="Your offerings" subtitle={`${offerings.data?.length ?? 0} services`} />
        {offerings.isError ? (
          <ErrorState message="Offerings could not be loaded." onRetry={() => void offerings.refetch()} />
        ) : offerings.isLoading ? (
          <ListSkeleton rows={3} />
        ) : offerings.data?.length ? (
          <View style={{ gap: spacing.md }}>
            {offerings.data.map((offering) => {
              const toggling = toggle.isPending && toggle.variables?.id === offering.id;
              const deleting = remove.isPending && remove.variables === offering.id;
              const updating = update.isPending && update.variables?.id === offering.id;
              return (
                <Card key={offering.id} variant="elevated" style={[cardStyle, elevation.subtle]}>
                  <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                    <View style={{ width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
                      <Wrench size={18} color={colors.primaryDark} />
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={[typography.bodyStrong, { color: colors.text }]}>{offering.title ?? offering.service?.name ?? 'Service'}</Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{offering.service?.name ?? 'Service offering'}</Text>
                      {offering.service?.category?.name ? (
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{offering.service.category.name}</Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={[typography.small, { color: colors.primaryDark }]}>{formatMoney(offering.basePrice)}</Text>
                        {offering.priceType ? (
                          <Badge label={humanize(offering.priceType)} tone="neutral" />
                        ) : null}
                        {offering.duration !== null && offering.duration !== undefined && offering.duration !== '' ? (
                          <Text style={[typography.caption, { color: colors.textMuted }]}>{String(offering.duration)}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Badge label={offering.isActive ? 'Active' : 'Paused'} tone={offering.isActive ? 'success' : 'neutral'} />
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Visible to clients</Text>
                    <Switch
                      value={offering.isActive}
                      disabled={toggling}
                      accessibilityLabel={`Set ${offering.title ?? offering.service?.name ?? 'service'} visibility`}
                      onValueChange={(isActive) => toggle.mutate({ id: offering.id, isActive })}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                      thumbColor={colors.white}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button
                      label="Edit"
                      variant="secondary"
                      size="sm"
                      icon={<Pencil size={14} color={colors.primaryDark} />}
                      loading={updating}
                      onPress={() => openEdit(offering)}
                    />
                    <Button
                      label="Delete"
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={14} color={colors.white} />}
                      loading={deleting}
                      onPress={() => setPendingDeleteId(offering.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No offerings yet"
            message="Add a service with a price so clients can request it."
            actionLabel="Add offering"
            onAction={openCreate}
          />
        )}
      </View>

      <BottomSheet
        visible={showForm}
        title={editingId ? 'Edit offering' : 'New offering'}
        onClose={closeForm}
        footer={
          <Button
            label={editingId ? 'Save changes' : 'Create offering'}
            onPress={submit}
            loading={create.isPending || update.isPending}
            fullWidth
          />
        }
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
            {services.isError ? (
              <Notice message="Services could not be loaded." tone="error" />
            ) : services.isLoading ? (
              <ListSkeleton rows={2} />
            ) : services.data?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {services.data.map((service) => (
                  <Chip
                    key={service.id}
                    label={service.name}
                    selected={service.id === selectedServiceId}
                    onPress={() => setValue('serviceId', service.id, { shouldValidate: true, shouldDirty: true })}
                  />
                ))}
              </View>
            ) : (
              <Notice message="No catalog services are available yet." tone="info" />
            )}
            <Text style={[typography.caption, { color: selectedServiceName ? colors.success : colors.textMuted }]}>
              {selectedServiceName ? `Selected: ${selectedServiceName}` : 'Choose a service from the list above.'}
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Price type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {priceTypes.map((type) => (
                <Chip
                  key={type}
                  label={humanize(type)}
                  tone="neutral"
                  selected={selectedPriceType === type}
                  onPress={() => setValue('priceType', type, { shouldValidate: true, shouldDirty: true })}
                />
              ))}
            </View>
          </View>

          <FormInput label="Title" control={control} name="title" error={errors.title?.message} />
          <FormInput label="Description" control={control} name="description" error={errors.description?.message} multiline numberOfLines={3} />
          <FormInput label="Base price" control={control} name="basePrice" error={errors.basePrice?.message} keyboardType="numeric" />
          <FormInput label="Duration" control={control} name="duration" error={errors.duration?.message} placeholder="e.g. 3 hours" />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={pendingDeleteId !== null}
        title="Delete this offering?"
        message="Clients will no longer be able to request this service offering."
        confirmLabel="Delete offering"
        destructive
        loading={remove.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) remove.mutate(pendingDeleteId);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1 },
});
