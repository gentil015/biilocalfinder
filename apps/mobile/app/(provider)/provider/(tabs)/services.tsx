import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys, useOfferings, useServices } from '@/src/hooks/queries';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatMoney, humanize } from '@/src/utils/format';
import { offeringFormSchema } from '@/src/utils/validation';
import type { OfferingItem } from '@/src/types/api';

type Values = z.infer<typeof offeringFormSchema>;
type NoticeState = { message: string; tone: NoticeTone } | null;
type AttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'PRICE' | 'SELECT' | 'MULTI_SELECT';
type AttributeValues = Record<string, unknown>;

interface CategoryAttribute {
  id: string;
  name: string;
  description?: string | null;
  type: AttributeType;
  isRequired?: boolean;
  options?: string[] | null;
}

const priceTypes: Values['priceType'][] = ['FIXED', 'HOURLY', 'PER_DAY', 'STARTING_FROM', 'CUSTOM_QUOTE'];
const emptyValues: Values = { serviceId: '', priceType: 'FIXED', basePrice: '', duration: '' };

function attributeValuesFromOffering(value: unknown): AttributeValues {
  if (!value || typeof value !== 'object') return {};
  if (!Array.isArray(value)) return value as AttributeValues;
  const result: AttributeValues = {};
  for (const entry of value as Array<Record<string, unknown>>) {
    const id = entry.categoryAttributeId ?? entry.attributeId ?? (entry.categoryAttribute as { id?: string } | null)?.id;
    if (typeof id !== 'string') continue;
    if (typeof entry.booleanValue === 'boolean') result[id] = entry.booleanValue;
    else if (Array.isArray(entry.jsonValue)) result[id] = entry.jsonValue.map(String);
    else if (typeof entry.numberValue === 'number') result[id] = entry.numberValue;
    else if (typeof entry.textValue === 'string') result[id] = entry.textValue;
    else result[id] = '';
  }
  return result;
}

function toDto(values: Values, attributeValues: AttributeValues) {
  return {
    serviceId: values.serviceId,
    title: values.title || undefined,
    description: values.description || undefined,
    basePrice: values.basePrice === '' || values.basePrice === undefined ? undefined : Number(values.basePrice),
    priceType: values.priceType,
    duration: values.duration || undefined,
    attributeValues,
  };
}

export default function ProviderServicesScreen() {
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});
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
  const selectedService = services.data?.find((service) => service.id === selectedServiceId);
  const selectedServiceName = selectedService?.name;
  const attributesQuery = useQuery({
    queryKey: ['category-attributes', selectedService?.categoryId ?? null],
    queryFn: () => discoveryApi.categoryAttributes(selectedService!.categoryId),
    enabled: Boolean(selectedService?.categoryId),
  });
  const attributes = ((attributesQuery.data ?? []) as CategoryAttribute[]).filter(
    (attribute) => typeof attribute?.id === 'string' && typeof attribute?.name === 'string' && typeof attribute?.type === 'string',
  );

  const invalidate = async () => queryClient.invalidateQueries({ queryKey: queryKeys.offerings });
  const reportError = (error: unknown) => {
    const message = toApiError(error).message;
    setNotice({ message, tone: 'error' });
    showToast(message, 'error');
  };
  const create = useMutation({
    mutationFn: (values: Values) => providerApi.createOffering(toDto(values, attributeValues)),
    onSuccess: async () => {
      await invalidate();
      reset(emptyValues);
      setAttributeValues({});
      setShowForm(false);
      setNotice({ message: 'Service offering created.', tone: 'success' });
      showToast('Service offering created.', 'success');
    },
    onError: reportError,
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Values }) => providerApi.updateOffering(id, toDto(values, attributeValues)),
    onSuccess: async () => {
      await invalidate();
      reset(emptyValues);
      setAttributeValues({});
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
    setAttributeValues({});
    setEditingId(null);
    setShowForm(false);
    setNotice(null);
  };
  const openCreate = () => {
    reset(emptyValues);
    setAttributeValues({});
    setEditingId(null);
    setNotice(null);
    setShowForm(true);
  };
  const selectService = (serviceId: string) => {
    setValue('serviceId', serviceId, { shouldValidate: true, shouldDirty: true });
    setAttributeValues({});
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
    setAttributeValues(attributeValuesFromOffering(offering.attributeValues));
    setEditingId(offering.id);
    setNotice(null);
    setShowForm(true);
  };
  const hasAttributeValue = (attribute: CategoryAttribute) => {
    const value = attributeValues[attribute.id];
    if (attribute.type === 'BOOLEAN') return typeof value === 'boolean';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
  };
  const submit = handleSubmit((values) => {
    const missing = attributes.find((attribute) => attribute.isRequired && !hasAttributeValue(attribute));
    if (missing) {
      setNotice({ message: `"${missing.name}" is required.`, tone: 'error' });
      return;
    }
    if (editingId) update.mutate({ id: editingId, values });
    else create.mutate(values);
  });
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  const setAttribute = (id: string, value: unknown) =>
    setAttributeValues((current) => ({ ...current, [id]: value }));
  const renderAttribute = (attribute: CategoryAttribute) => {
    const value = attributeValues[attribute.id];
    const label = `${attribute.name}${attribute.isRequired ? ' *' : ''}`;
    const options = Array.isArray(attribute.options) ? attribute.options.map(String) : [];
    const caption = attribute.description ? (
      <Text style={[typography.caption, { color: colors.textMuted }]}>{attribute.description}</Text>
    ) : null;
    if (attribute.type === 'BOOLEAN') {
      return (
        <View key={attribute.id} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>{label}</Text>
            <Switch
              value={value === true}
              accessibilityLabel={attribute.name}
              onValueChange={(next) => setAttribute(attribute.id, next)}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.white}
            />
          </View>
          {caption}
        </View>
      );
    }
    if (attribute.type === 'SELECT' || attribute.type === 'MULTI_SELECT') {
      const selected = attribute.type === 'SELECT' ? value : Array.isArray(value) ? value.map(String) : [];
      return (
        <View key={attribute.id} style={{ gap: spacing.sm }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {attribute.type === 'MULTI_SELECT' ? (
              <Chip
                label="Not set"
                tone="neutral"
                selected={!Array.isArray(value) || value.length === 0}
                onPress={() => setAttribute(attribute.id, [])}
              />
            ) : (
              <Chip
                label="Not set"
                tone="neutral"
                selected={value === undefined || value === null || value === ''}
                onPress={() => setAttribute(attribute.id, undefined)}
              />
            )}
            {options.map((option) => (
              <Chip
                key={option}
                label={option}
                tone="neutral"
                selected={
                  attribute.type === 'SELECT'
                    ? selected === option
                    : (selected as string[]).includes(option)
                }
                onPress={() => {
                  if (attribute.type === 'SELECT') setAttribute(attribute.id, option);
                  else {
                    const current = Array.isArray(value) ? value.map(String) : [];
                    setAttribute(
                      attribute.id,
                      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
                    );
                  }
                }}
              />
            ))}
          </View>
          {caption}
        </View>
      );
    }
    return (
      <View key={attribute.id} style={{ gap: spacing.xs }}>
        <Input
          label={label}
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={(text) =>
            setAttribute(
              attribute.id,
              attribute.type === 'TEXT' ? text : text === '' ? undefined : Number(text),
            )
          }
          keyboardType={attribute.type === 'TEXT' ? 'default' : 'numeric'}
          placeholder={attribute.description ?? undefined}
        />
        {caption}
      </View>
    );
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
                    onPress={() => selectService(service.id)}
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

          {selectedServiceId ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Service attributes</Text>
              {attributesQuery.isError ? <Notice message="Attributes for this service could not be loaded." tone="error" /> : null}
              {attributesQuery.isLoading ? <ListSkeleton rows={2} /> : null}
              {attributes.length ? attributes.map(renderAttribute) : null}
              {!attributesQuery.isLoading && !attributesQuery.isError && attributes.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  No extra details are required for this service.
                </Text>
              ) : null}
            </View>
          ) : null}

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
