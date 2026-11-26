import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CalendarDays, Clock, ImagePlus, MapPin, Sparkles, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { FormInput } from '@/src/components/ui/FormInput';
import { Input } from '@/src/components/ui/Input';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import { filesApi } from '@/src/services/api/endpoints/files';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import { parityCustomerApi } from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { queryKeys, useCategories, useServices } from '@/src/hooks/queries';
import { useAppStore } from '@/src/stores/app.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { serviceRequestFormSchema } from '@/src/utils/validation';

type FormValues = z.infer<typeof serviceRequestFormSchema>;

type AttributeDef = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isRequired?: boolean;
  options?: string[] | null;
  description?: string | null;
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(base: Date, days: number) { const d = new Date(base); d.setDate(d.getDate() + days); return d; }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatDateLabel(value: string) { const d = new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-RW', { weekday: 'short', day: 'numeric', month: 'short' }); }
function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function budgetParam(value: string | string[] | undefined): number | '' | undefined {
  const raw = paramValue(value);
  if (!raw) return '';
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : '';
}
function asAttributeDefs(value: unknown): AttributeDef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return [];
    return [{
      id: raw.id,
      name: raw.name,
      slug: typeof raw.slug === 'string' ? raw.slug : raw.id,
      type: typeof raw.type === 'string' ? raw.type : 'TEXT',
      isRequired: raw.isRequired === true,
      options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === 'string') : null,
      description: typeof raw.description === 'string' ? raw.description : null,
    }];
  });
}
function parseAttributeValues(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
function asStringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function AttributeInput({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const { colors } = useTheme();
  if (attribute.type === 'BOOLEAN') {
    return (
      <View style={styles.switchRow}>
        <Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>{attribute.name}</Text>
        <Switch value={value === true} onValueChange={onChange} accessibilityLabel={attribute.name} />
      </View>
    );
  }
  if (attribute.type === 'SELECT' || attribute.type === 'MULTI_SELECT') {
    const selected = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : [];
    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.small, { color: colors.textSecondary }]}>{attribute.name}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(attribute.options ?? []).map((option) => {
            const active = selected.includes(option);
            return (
              <Chip
                key={option}
                label={option}
                selected={active}
                onPress={() => {
                  if (attribute.type === 'SELECT') onChange(active ? undefined : option);
                  else onChange(active ? selected.filter((item) => item !== option) : [...selected, option]);
                }}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }
  const numeric = attribute.type === 'NUMBER' || attribute.type === 'PRICE';
  return (
    <Input
      label={attribute.name}
      value={asStringValue(value)}
      onChangeText={(text) => onChange(numeric ? (text === '' ? '' : Number(text)) : text)}
      keyboardType={numeric ? 'numeric' : 'default'}
      hint={attribute.description ?? undefined}
    />
  );
}

export default function NewServiceRequestScreen() {
  const params = useLocalSearchParams<{
    providerId?: string;
    serviceId?: string;
    serviceOfferingId?: string;
    title?: string;
    description?: string;
    preferredDate?: string;
    preferredTime?: string;
    budgetMin?: string;
    budgetMax?: string;
    additionalNotes?: string;
    notes?: string;
    isPublic?: string;
    locationId?: string;
    locationLabel?: string;
    attributeValues?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const categories = useCategories();
  const storedLocation = useAppStore((state) => state.selectedLocation);
  const locationId = (storedLocation as unknown as { id?: string } | null)?.id ?? paramValue(params.locationId);
  const locationLabel = storedLocation?.label ?? paramValue(params.locationLabel);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const services = useServices(categoryId);
  const allServices = useServices(undefined);
  const [images, setImages] = useState<Array<{ key: string; url: string; uploading?: boolean; error?: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [assistConsent, setAssistConsent] = useState(false);
  const [isPublic, setIsPublic] = useState(paramValue(params.isPublic) === 'true');
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>(() => parseAttributeValues(paramValue(params.attributeValues)));
  const {
    control,
    setValue,
    getValues,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(serviceRequestFormSchema),
    defaultValues: {
      serviceId: paramValue(params.serviceId) ?? '',
      serviceOfferingId: paramValue(params.serviceOfferingId),
      providerId: paramValue(params.providerId),
      title: paramValue(params.title) ?? '',
      description: paramValue(params.description) ?? '',
      preferredDate: paramValue(params.preferredDate) || todayStr(),
      preferredTime: paramValue(params.preferredTime) ?? '',
      budgetMin: budgetParam(params.budgetMin),
      budgetMax: budgetParam(params.budgetMax),
      additionalNotes: paramValue(params.additionalNotes) ?? paramValue(params.notes) ?? '',
      images: [],
    },
  });

  const selectedServiceId = watch('serviceId');
  const selectedServiceOfferingId = watch('serviceOfferingId');
  const preferredDate = watch('preferredDate');
  const preferredTime = watch('preferredTime');
  const dateOptions = useMemo(() => Array.from({ length: 14 }, (_, i) => toDateStr(addDays(new Date(), i))), []);
  const timeOptions = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const serviceOptions = (categoryId ? services.data : allServices.data) ?? [];
  const selectedServiceName = (allServices.data ?? services.data ?? []).find((s) => s.id === selectedServiceId)?.name;
  const attributeCategoryId = (allServices.data ?? services.data ?? []).find((s) => s.id === selectedServiceId)?.categoryId ?? categoryId;
  const categoryAttributes = useQuery({
    queryKey: ['category-attributes', attributeCategoryId ?? null],
    queryFn: () => discoveryApi.categoryAttributes(attributeCategoryId!),
    enabled: Boolean(attributeCategoryId),
  });
  const attributes = asAttributeDefs(categoryAttributes.data);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      requestsApi.create({
        serviceId: values.serviceId || undefined,
        providerId: values.providerId || undefined,
        serviceOfferingId: values.serviceOfferingId || undefined,
        isPublic,
        locationId: locationId || undefined,
        attributeValues: Object.keys(attributeValues).length ? attributeValues : undefined,
        title: values.title?.trim() || undefined,
        description: values.description?.trim() || undefined,
        preferredDate: values.preferredDate,
        preferredTime: values.preferredTime || undefined,
        budgetMin: values.budgetMin === '' || values.budgetMin === undefined ? undefined : Number(values.budgetMin),
        budgetMax: values.budgetMax === '' || values.budgetMax === undefined ? undefined : Number(values.budgetMax),
        additionalNotes: values.additionalNotes || undefined,
        images: images.filter((i) => !i.uploading && !i.error).map((image) => image.key).length
          ? images.filter((i) => !i.uploading && !i.error).map((image) => image.key)
          : undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myRequests }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      ]);
      router.push('/(customer)/(tabs)/requests');
    },
    onError: (error) => setNotice(toApiError(error).message),
  });

  const assist = useMutation({
    mutationFn: () => {
      const values = getValues();
      return parityCustomerApi.suggestRequest({
        serviceId: values.serviceId!,
        description: values.description,
        imageKey: images.find((i) => !i.error && !i.uploading)?.key,
        consentToProcess: assistConsent,
      });
    },
    onSuccess: (result) => {
      if (result.title) setValue('title', result.title, { shouldValidate: true });
      if (result.description) setValue('description', result.description, { shouldValidate: true });
      if (Object.keys(result.attributeValues ?? {}).length) {
        setAttributeValues((current) => ({ ...result.attributeValues, ...current }));
      }
      setNotice('AI draft added. Review it before sending.');
    },
    onError: (error) => setNotice(toApiError(error).message),
  });

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (result.canceled) return;
    const remaining = 5 - images.length;
    const assets = result.assets.slice(0, remaining);
    for (const asset of assets) {
      const tempId = `${Date.now()}-${Math.random()}`;
      setImages((current) => [...current, { key: tempId, url: asset.uri, uploading: true }]);
      try {
        const uploaded = await filesApi.uploadImage(asset);
        setImages((current) => current.map((img) => img.key === tempId ? { key: uploaded.key, url: uploaded.url } : img));
      } catch (error) {
        setImages((current) => current.map((img) => img.key === tempId ? { ...img, uploading: false, error: toApiError(error).message } : img));
      }
    }
  };

  const selectService = (id: string) => {
    setValue('serviceId', id, { shouldValidate: true });
    setAttributeValues({});
  };

  return (
    <Screen>
      <AppScreenHeader title="Request a service" subtitle={selectedServiceName ? `For ${selectedServiceName}` : 'Tell us what you need'} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <Notice message={notice} tone={notice?.includes('AI draft') ? 'success' : notice ? 'error' : 'info'} />

        <Card variant="muted" style={{ gap: spacing.md }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Service</Text>
          {selectedServiceOfferingId ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{selectedServiceName ?? 'Selected service'}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                This request is tied to the selected service offering. Add location, timing, and optional details.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
                {categories.data?.slice(0, 10).map((c) => (
                  <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? undefined : c.id)} />
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {serviceOptions.slice(0, 12).map((service) => (
                  <Chip
                    key={service.id}
                    label={service.name}
                    selected={selectedServiceId === service.id}
                    onPress={() => selectService(service.id)}
                  />
                ))}
              </ScrollView>
              <FormInput label="Service ID" control={control} name="serviceId" error={errors.serviceId?.message} placeholder="Select a service" editable={!params.serviceId} />
            </>
          )}
        </Card>

        {attributes.length ? (
          <Card variant="muted" style={{ gap: spacing.md }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Service details</Text>
            {attributes.map((attribute) => (
              <AttributeInput
                key={attribute.id}
                attribute={attribute}
                value={attributeValues[attribute.id]}
                onChange={(value) => setAttributeValues((current) => {
                  const next = { ...current };
                  if (value === undefined || value === '') delete next[attribute.id];
                  else next[attribute.id] = value;
                  return next;
                })}
              />
            ))}
          </Card>
        ) : null}

        {!selectedServiceOfferingId && !paramValue(params.providerId) ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>Open request</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Share this request with all available professionals.</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="Open request" />
            </View>
          </Card>
        ) : null}

        <Card variant="muted" style={{ gap: spacing.sm }}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/location')} style={styles.switchRow}>
            <MapPin size={16} color={colors.primaryDark} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Location</Text>
              <Text style={[typography.small, { color: colors.text }]}>{locationLabel ?? 'Set a location'}</Text>
            </View>
            <Text style={[typography.caption, { color: colors.primaryDark }]}>{locationLabel ? 'Change' : 'Choose'}</Text>
          </Pressable>
        </Card>

        {!selectedServiceOfferingId ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={styles.assistRow}>
                <Sparkles size={18} color={colors.primaryDark} />
                <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>Draft with AI</Text>
                <Switch value={assistConsent} onValueChange={setAssistConsent} accessibilityLabel="Allow AI processing" />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Allow AI processing of your description to suggest a clearer title and details.</Text>
              <Button label="Suggest a draft" variant="secondary" size="sm" disabled={!assistConsent || !selectedServiceId} loading={assist.isPending} onPress={() => assist.mutate()} />
            </Card>

            <FormInput label="Title" control={control} name="title" error={errors.title?.message} placeholder="e.g. Lawn mowing this weekend" />
            <FormInput label="Description" control={control} name="description" error={errors.description?.message} placeholder="Describe what you need done" multiline numberOfLines={4} />
          </>
        ) : (
          <Card variant="muted" style={{ gap: spacing.xs }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>What’s needed</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              The selected service already defines what you’re booking. Add location, preferred time, photos, or notes below.
            </Text>
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
          <View style={styles.labelRow}><CalendarDays size={16} color={colors.primary} /><Text style={[typography.bodyStrong, { color: colors.text }]}>Preferred date</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {dateOptions.map((d) => (
              <Chip key={d} label={formatDateLabel(d)} selected={preferredDate === d} onPress={() => setValue('preferredDate', d, { shouldValidate: true })} />
            ))}
          </ScrollView>
          <FormInput label="Date (YYYY-MM-DD)" control={control} name="preferredDate" error={errors.preferredDate?.message} placeholder="2026-12-15" />
        </View>

        <View style={{ gap: spacing.sm }}>
          <View style={styles.labelRow}><Clock size={16} color={colors.primary} /><Text style={[typography.bodyStrong, { color: colors.text }]}>Preferred time</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Any time" selected={!preferredTime} onPress={() => setValue('preferredTime', '', { shouldValidate: true })} />
            {timeOptions.map((t) => (
              <Chip key={t} label={t} selected={preferredTime === t} onPress={() => setValue('preferredTime', t, { shouldValidate: true })} />
            ))}
          </ScrollView>
          <FormInput label="Time (HH:MM)" control={control} name="preferredTime" error={errors.preferredTime?.message} placeholder="09:00" />
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}><FormInput label="Budget min (RWF)" control={control} name="budgetMin" error={errors.budgetMin?.message} keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><FormInput label="Budget max (RWF)" control={control} name="budgetMax" error={errors.budgetMax?.message} keyboardType="numeric" /></View>
        </View>
        <FormInput label="Additional notes" control={control} name="additionalNotes" error={errors.additionalNotes?.message} multiline numberOfLines={3} />

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Photos</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={() => void pickImages()} style={[styles.upload, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
            <ImagePlus size={18} color={colors.primaryDark} />
            <Text style={[typography.small, { color: colors.primaryDark }]}>Add up to 5 photos</Text>
          </Pressable>
          {images.length ? (
            <View style={styles.imageRow}>
              {images.map((image, index) => (
                <View key={`${image.key}-${index}`} style={styles.imageWrap}>
                  <ExpoImage source={{ uri: image.url }} style={styles.image} contentFit="cover" />
                  {image.uploading ? (
                    <View style={[styles.imageOverlay, { backgroundColor: colors.overlay }]}>
                      <Text style={[typography.caption, { color: colors.white }]}>Uploading…</Text>
                    </View>
                  ) : null}
                  {image.error ? (
                    <View style={[styles.imageOverlay, { backgroundColor: colors.danger }]}>
                      <Text style={[typography.caption, { color: colors.white }]}>Failed</Text>
                    </View>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setImages((current) => current.filter((_, i) => i !== index))} style={[styles.remove, { backgroundColor: colors.danger }]}>
                    <X size={12} color={colors.white} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <Button label="Send request" onPress={handleSubmit((values) => mutation.mutate(values))} loading={isSubmitting || mutation.isPending} disabled={images.some((i) => i.uploading)} fullWidth />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assistRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.md },
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 52, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  imageWrap: { position: 'relative' },
  image: { width: 72, height: 72, borderRadius: radius.sm },
  imageOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
