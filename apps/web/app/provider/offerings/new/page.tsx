'use client';

import { useI18n } from '@/components/locale-provider';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ApiError,
  categoriesApi,
  offeringsApi,
  providerOnboardingApi,
  providersApi,
  servicesApi,
  type ProviderOnboardingState,
} from '@/lib/api';
import { categoryGroups, type CategoryNode } from '@/lib/categories';
import { DynamicAttributeForm } from '@/components/attributes/dynamic-attribute-form';
import { SearchablePicker, type SearchableOption } from '@/components/ui/searchable-picker';
import { LocationPickerMap } from '@/components/location-picker-map';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { PageHeader, Panel } from '@/components/ui/page';
import { HelpHint } from '@/components/help-hint';

const DEFAULT_LOCATION = { lat: -1.9441, lng: 30.0619 }; // Kigali

function NewServiceOfferingForm() {
  const { translateMessage: tr } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === '1';
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    basePrice: '',
    priceType: 'FIXED',
    duration: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onboardingState, setOnboardingState] = useState<ProviderOnboardingState | null>(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationChanged, setLocationChanged] = useState(false);

  // A provider who already created their first service but never finished
  // onboarding (the old flow stopped here) only needs a location before we
  // can mark setup complete — asking them to create the same offering again
  // would fail with "You already have an offering for this service".
  const skipOffering = isOnboarding && onboardingState?.hasActiveOffering;

  useEffect(() => {
    if (!isOnboarding) return;
    providerOnboardingApi
      .getState()
      .then((state) => {
        setOnboardingState(state);
        if (state.location) {
          setLocation({ lat: state.location.latitude, lng: state.location.longitude });
        }
      })
      .catch(() => {});
  }, [isOnboarding]);

  useEffect(() => {
    categoriesApi.tree().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setServiceId('');
    setServices([]);
    if (!categoryId) return;
    servicesApi
      .list(categoryId)
      .then((list) => {
        const rows = list ?? [];
        setServices(rows);
        // A sub-category with exactly one service needs no extra choice.
        if (rows.length === 1) setServiceId(rows[0].id);
      })
      .catch(() => setServices([]));
  }, [categoryId]);

  useEffect(() => {
    setAttributeValues({});
    if (!categoryId) {
      setAttributes([]);
      return;
    }
    categoriesApi.attributes(categoryId).then(setAttributes).catch(() => setAttributes([]));
  }, [categoryId]);

  const categoryOptions = useMemo<SearchableOption[]>(
    () =>
      categoryGroups(categories).flatMap((group) =>
        group.options.map((option) => ({ value: option.id, label: option.name, group: group.group })),
      ),
    [categories],
  );

  const serviceOptions = useMemo<SearchableOption[]>(
    () => services.map((service) => ({ value: service.id, label: service.name })),
    [services],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!skipOffering && !categoryId) {
      setError('Please choose a sub-category.');
      return;
    }
    if (!skipOffering && !serviceId) {
      setError(
        services.length === 0
          ? 'No service available for this sub-category. Please contact admin to add one.'
          : 'Please choose a service.',
      );
      return;
    }
    setLoading(true);
    try {
      if (skipOffering) {
        await providersApi.setLocation({ latitude: location.lat, longitude: location.lng });
        await providerOnboardingApi.complete();
        router.push('/provider/dashboard');
        return;
      }
      const offering = await offeringsApi.create({
        serviceId,
        title: form.title || undefined,
        description: form.description || undefined,
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        priceType: form.priceType,
        duration: form.duration || undefined,
        attributeValues,
      });
      if (isOnboarding) {
        // Finishing setup still needs a base location even though the
        // simplified flow no longer has a dedicated step for it.
        if (!onboardingState?.location || locationChanged) {
          await providersApi.setLocation({ latitude: location.lat, longitude: location.lng });
        }
        await providerOnboardingApi.complete();
        router.push('/provider/dashboard');
        return;
      }
      router.push(`/provider/offerings?created=${offering.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create service offering');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-narrow py-6 pb-28 md:py-8">
      {isOnboarding && <OnboardingProgress step={3} label={tr("First service")} />}

      <PageHeader
        eyebrow={tr("Services")}
        title={skipOffering ? 'Finish setting up' : 'Add a service'}
        description={
          skipOffering
            ? 'Your first service is already listed. Set your base location to finish setting up your workspace.'
            : 'Tell clients about this service — the details below adjust automatically based on what you pick.'
        }
        actions={!skipOffering ? <HelpHint text="Pick a category, describe your service, add price and answer any questions. These details appear when clients request this exact offering." /> : undefined}
      />

      <form onSubmit={onSubmit}>
        {skipOffering && (
          <Panel title={tr("First service created")} className="mb-4">
            <p className="text-sm text-ink-600">
              {tr("You already added your first service. Confirm where you are based and we'll take you to your dashboard.")}
            </p>
          </Panel>
        )}

        {!skipOffering && (
          <>
        <Panel title={tr("Choose your service")} className="mb-4">
          <div className="field">
            <label htmlFor="offering-category" className="label">
              {tr("Sub-category")}
            </label>
            <SearchablePicker
              id="offering-category"
              options={categoryOptions}
              value={categoryId}
              onChange={(next) => {
                setCategoryId(next);
                setServiceId('');
              }}
              placeholder={tr("Select sub-category…")}
              searchPlaceholder={tr("Search categories…")}
              emptyLabel={tr("No matching sub-category")}
            />
          </div>
          {categoryId && (
            <div className="field mb-0 mt-4">
              <label htmlFor="offering-service" className="label">
                {tr("Service")}
              </label>
              {services.length === 0 ? (
                <p className="text-sm text-ink-500">
                  {tr("No services available for this sub-category yet.")}
                </p>
              ) : (
                <SearchablePicker
                  id="offering-service"
                  options={serviceOptions}
                  value={serviceId}
                  onChange={setServiceId}
                  placeholder={tr("Select service…")}
                  searchPlaceholder={tr("Search services…")}
                  emptyLabel={tr("No matching service")}
                />
              )}
            </div>
          )}
        </Panel>

        <Panel title={tr("Describe it")} className="mb-4">
          <div className="field">
            <label htmlFor="offering-title" className="label">
              {tr("Title")} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
            </label>
            <input
              id="offering-title"
              placeholder={tr("e.g. Wedding Photography")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="field mb-0 mt-4">
            <label htmlFor="offering-description" className="label">
              {tr("Description")}
            </label>
            <textarea
              id="offering-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </Panel>

        <Panel title={tr("Pricing & time")} className="mb-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="offering-price" className="label">
                {tr("Base price (RWF)")}
              </label>
              <input
                id="offering-price"
                type="number"
                min={0}
                className="tabular"
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="offering-price-type" className="label">
                {tr("Price type")}
              </label>
              <select
                id="offering-price-type"
                value={form.priceType}
                onChange={(e) => setForm({ ...form, priceType: e.target.value })}
              >
                <option value="FIXED">{tr("Fixed")}</option>
                <option value="HOURLY">{tr("Hourly")}</option>
                <option value="PER_DAY">{tr("Per day")}</option>
                <option value="STARTING_FROM">{tr("Starting from")}</option>
                <option value="CUSTOM_QUOTE">{tr("Custom quote")}</option>
              </select>
            </div>
          </div>
          <div className="field mb-0 mt-4">
            <label htmlFor="offering-duration" className="label">
              {tr("Duration")} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
            </label>
            <input
              id="offering-duration"
              placeholder={tr("e.g. 2 hours, half day")}
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </div>
        </Panel>

        {attributes.length > 0 && (
          <Panel title={tr("Tell clients about your service")} description={tr("Details specific to the category you chose.")} className="mb-4">
            <DynamicAttributeForm
              attributes={attributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />
          </Panel>
        )}
          </>
        )}

        {isOnboarding && (
          <Panel
            title={tr("Your base location")}
            description={tr("Clients see how far away you are. Drag the pin or click the map to adjust it.")}
            className="mb-4"
          >
            <div className="overflow-hidden rounded-xl border border-ink-200">
              <LocationPickerMap
                center={location}
                onCenterChange={(pos) => {
                  setLocation(pos);
                  setLocationChanged(true);
                }}
              />
            </div>
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition((pos) => {
                  setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setLocationChanged(true);
                });
              }}
            >
              {tr("Use my current location")}
            </button>
          </Panel>
        )}

        {/* Sticky submit — stays within reach while the category attributes
            grow the form well past a screenful. */}
        <div className="sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-10 rounded-xl border border-ink-200 bg-surface/90 p-3 shadow-xs backdrop-blur-xl md:bottom-0">
          {error && (
            <p className="error-text mb-3" role="alert">
              {tr(error)}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
            {loading ? 'Saving…' : skipOffering ? 'Finish setup' : isOnboarding ? 'Add service & finish' : 'Add service'}
          </button>
        </div>
      </form>
    </main>
  );
}

// useSearchParams needs a Suspense boundary during static prerendering.
export default function NewServiceOfferingPage() {
  const { translateMessage: tr } = useI18n();
  return (
    <Suspense fallback={null}>
      <NewServiceOfferingForm />
    </Suspense>
  );
}