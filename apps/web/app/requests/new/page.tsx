'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Globe,
  Info,
  Lock,
  Send,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  ApiError,
  BookingAssistFields,
  categoriesApi,
  offeringsApi,
  providersApi,
  requestsApi,
  servicesApi,
} from '@/lib/api';
import { DynamicAttributeForm } from '@/components/attributes/dynamic-attribute-form';
import { BookingPath } from '@/components/booking-path';
import { AiRequestAssist, AssistSuggestion } from '@/components/requests/ai-request-assist';
import { BookingAssistant } from '@/components/requests/booking-assistant';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';
import { PageHeader, Panel } from '@/components/ui/page';
import { useAuth } from '@/components/auth-provider';

const TITLE_MAX = 90;
const DESCRIPTION_MAX = 2000;

type RequestStepId = 'basics' | 'details' | 'schedule' | 'review';

interface RequestStep {
  id: RequestStepId;
  short: string;
  title: string;
  body: string;
  icon: typeof ClipboardList;
}

const VALIDATED_STEPS: RequestStepId[] = ['basics', 'details', 'schedule'];

function StepRail({ steps, currentIndex }: { steps: RequestStep[]; currentIndex: number }) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('requestSteps.progress')}
      className="mb-5 rounded-xl border border-ink-200 bg-surface p-4 shadow-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
          {t('requestSteps.step', {
            current: String(currentIndex + 1),
            total: String(steps.length),
          })}
        </p>
        <p className="text-sm font-bold text-ink-950 sm:hidden">{steps[currentIndex].title}</p>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100 sm:hidden">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-0.5 hidden items-start sm:flex">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular transition-colors ${
                  done
                    ? 'bg-success-600 text-white'
                    : current
                      ? 'bg-brand-600 text-white dark:text-home-night'
                      : 'bg-ink-100 text-ink-400'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={`min-w-0 pt-1 text-xs font-bold ${
                  current ? 'text-ink-950' : done ? 'text-ink-600' : 'text-ink-400'
                }`}
              >
                {step.short}
              </span>
              {i < steps.length - 1 && (
                <span className="mt-3.5 h-px flex-1 bg-ink-200" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function NewServiceRequestForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const providerId = searchParams.get('providerId') ?? undefined;
  const serviceOfferingId = searchParams.get('serviceOfferingId') ?? undefined;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router]);

  const [services, setServices] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [form, setForm] = useState({
    serviceId: searchParams.get('serviceId') ?? '',
    title: '',
    description: '',
    preferredDate: '',
    preferredTime: '',
    budgetMin: '',
    budgetMax: '',
    additionalNotes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Direct requests are private to the pinned provider by default. The
  // client can opt into opening the competition: if negotiating with them
  // stalls, other matching providers can also submit competing quotes.
  const [openToOthers, setOpenToOthers] = useState(false);

  // Fields the client typed by hand — a later AI assistant turn must never
  // overwrite them, so manual edits always survive the conversation.
  const [editedByUser, setEditedByUser] = useState<Record<string, true>>({});

  // When the client deep-links to a specific provider offering, the request
  // must "follow what the provider set": the features the provider published
  // on that offering are carried into the request as-is (locked, not
  // re-answered), and only the remaining category questions stay editable.
  const [offering, setOffering] = useState<any | null>(null);

  // When the client comes from a provider profile (providerId without a
  // pinned offering), the service field only lists the services that
  // provider actually serves — a request addressed to one provider has no
  // business offering every catalog service. Lazy: no provider, no fetch.
  const [provider, setProvider] = useState<any | null>(null);

  useEffect(() => {
    servicesApi.list().then(setServices).catch(() => setServices([]));
  }, []);

  useEffect(() => {
    if (!serviceOfferingId) {
      setOffering(null);
      return;
    }
    offeringsApi
      .getPublic(serviceOfferingId)
      .then((o) => {
        setOffering(o);
        setForm((prev) => {
          const next = { ...prev };
          if (!prev.title && o.title) next.title = o.title;
          if (!prev.description && o.description) next.description = o.description;
          if (!prev.serviceId && o.serviceId) next.serviceId = o.serviceId;
          if (o.basePrice != null && !prev.budgetMax && o.priceType !== 'HOURLY') {
            next.budgetMax = String(o.basePrice);
          }
          return next;
        });
      })
      .catch(() => setOffering(null));
  }, [serviceOfferingId]);

  useEffect(() => {
    if (!providerId) {
      setProvider(null);
      return;
    }
    providersApi
      .getPublic(providerId)
      .then(setProvider)
      .catch(() => setProvider(null));
  }, [providerId]);

  // Only relevant category-specific questions are ever shown — never a
  // carpenter's fields on a photography request (spec §20).
  useEffect(() => {
    setAttributeValues({});
    const service = services.find((s) => s.id === form.serviceId);
    if (!service?.category?.id) {
      setAttributes([]);
      return;
    }
    categoriesApi.attributes(service.category.id).then(setAttributes).catch(() => setAttributes([]));
  }, [form.serviceId, services]);

  // The ids of the services the pending provider serves (their active
  // offerings); null means the provider flow is not active and the full
  // catalog stays available.
  const providerServiceIds = useMemo(
    () =>
      provider
        ? new Set<string>(
            (provider.services ?? []).map((o: any) => o?.service?.id).filter((id: string | undefined) => !!id),
          )
        : null,
    [provider],
  );

  // Option label prefers the provider's own offering title ("Kitchen sink
  // repair") over the generic catalog name — it is what they actually serve.
  const offeringTitleByService = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of provider?.services ?? []) {
      if (o?.service?.id && o.title) m.set(o.service.id, o.title);
    }
    return m;
  }, [provider]);

  const availableServices = useMemo(
    () => (providerServiceIds ? services.filter((s) => providerServiceIds.has(s.id)) : services),
    [services, providerServiceIds],
  );

  // A provider that serves exactly one service pins it for the client —
  // there is nothing to choose between.
  useEffect(() => {
    if (!serviceOfferingId && providerServiceIds && providerServiceIds.size === 1 && !form.serviceId) {
      setForm((prev) => ({ ...prev, serviceId: Array.from(providerServiceIds)[0] }));
    }
  }, [providerServiceIds, serviceOfferingId, form.serviceId]);

  // Merges the AI assistant's extracted fields into the form. Only fields
  // the client has not edited by hand are touched, the assistant never
  // submits anything, and the service select is left alone when the page
  // was deep-linked to a specific offering (that service is pinned).
  function applyBookingFields(fields: BookingAssistFields) {
    const editable = (key: string) => !editedByUser[key];
    setForm((prev) => {
      const next = { ...prev };
      // The assistant may only switch services while one is in scope — and
      // never to one the pending provider does not serve.
      if (
        fields.serviceId &&
        !serviceOfferingId &&
        editable('serviceId') &&
        (!providerServiceIds || providerServiceIds.has(fields.serviceId))
      ) {
        next.serviceId = fields.serviceId;
      }
      if (fields.title !== undefined && editable('title')) next.title = fields.title;
      if (fields.description !== undefined && editable('description')) next.description = fields.description;
      if (fields.preferredDate !== undefined && editable('preferredDate')) next.preferredDate = fields.preferredDate;
      if (fields.preferredTime !== undefined && editable('preferredTime')) next.preferredTime = fields.preferredTime;
      if (fields.budgetMin !== undefined && editable('budgetMin')) next.budgetMin = String(fields.budgetMin);
      if (fields.budgetMax !== undefined && editable('budgetMax')) next.budgetMax = String(fields.budgetMax);
      if (fields.additionalNotes !== undefined && editable('additionalNotes')) next.additionalNotes = fields.additionalNotes;
      return next;
    });
    if (fields.attributeValues) {
      setAttributeValues((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(fields.attributeValues!)) {
          if (editable(`attr:${id}`)) next[id] = value;
        }
        return next;
      });
    }
  }

  function markEdited(...keys: string[]) {
    if (!keys.length) return;
    setEditedByUser((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = true;
      return next;
    });
  }

  // Merges suggestions into the existing form state — never overwrites an
  // attribute the client already filled in themselves, and the client
  // still sees every field afterward to edit or clear before submitting.
  function applySuggestion(suggestion: AssistSuggestion) {
    setForm((prev) => ({
      ...prev,
      title: suggestion.title ?? prev.title,
      description: suggestion.description ?? prev.description,
    }));
    setAttributeValues((prev) => ({ ...suggestion.attributeValues, ...prev }));
  }

  const budgetMin = form.budgetMin ? Number(form.budgetMin) : null;
  const budgetMax = form.budgetMax ? Number(form.budgetMax) : null;
  const budgetInverted = budgetMin !== null && budgetMax !== null && budgetMin > budgetMax;

  // --- Provider-set features (from the pinned offering) -------------------
  // The client requests *this* provider's service, so whatever the provider
  // configured on the offering is part of the request — locked into the
  // submit payload (and therefore the RequestAttributeSnapshot) as-is,
  // rather than being offered as blank questions the client must guess at.
  const providerSetIds = useMemo(
    () =>
      new Set<string>(
        (offering?.attributeValues ?? [])
          .map((av: any) => av.categoryAttribute?.id)
          .filter((id: string | undefined) => !!id),
      ),
    [offering],
  );

  // Raw values keyed by category attribute id, reconstructed from the
  // offering's typed columns so the shared request validation accepts them.
  const providerSetValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const av of offering?.attributeValues ?? []) {
      const attr = av.categoryAttribute;
      if (!attr?.id) continue;
      let raw: unknown;
      if (attr.type === 'BOOLEAN') raw = av.booleanValue;
      else if (attr.type === 'MULTI_SELECT') raw = av.jsonValue;
      else if (attr.type === 'NUMBER' || attr.type === 'PRICE') raw = av.numberValue;
      else if (av.textValue != null && av.textValue !== '') raw = av.textValue;
      if (raw !== undefined && raw !== null) out[attr.id] = raw;
    }
    return out;
  }, [offering]);

  // Read-only rendering of the provider-set features shown to the client.
  const fixedFeatures = useMemo(
    () =>
      (offering?.attributeValues ?? [])
        .map((av: any) => ({
          id: av.categoryAttribute?.id,
          label: av.categoryAttribute?.name,
          display: offeringValueDisplay(av, t),
        }))
        .filter((f: any) => f.id && f.display !== null && f.display !== ''),
    [offering, t],
  );

  // Attributes the provider didn't pin stay open for the client to answer.
  const openAttributes = useMemo(
    () => attributes.filter((a) => !providerSetIds.has(a.id)),
    [attributes, providerSetIds],
  );

  const hasAttributeSection = attributes.length > 0 || fixedFeatures.length > 0;
  const providerName = offering?.provider?.businessName ?? null;

  // A live readiness list: the client can see exactly what is still missing
  // instead of discovering it from a rejected submit.
  const checklist = useMemo(
    () =>
      [
        { label: t('requests.new.checkService'), done: !!form.serviceId },
        { label: t('requests.new.checkTitle'), done: form.title.trim().length > 0 },
        { label: t('requests.new.checkDesc'), done: form.description.trim().length > 0 },
        { label: t('requests.new.checkBudget'), done: !budgetInverted },
      ] as const,
    [form.serviceId, form.title, form.description, budgetInverted, t],
  );
  const ready = checklist.every((c) => c.done);

  const [stepId, setStepId] = useState<RequestStepId>('basics');
  const [stepError, setStepError] = useState<string | null>(null);

  const steps = useMemo<RequestStep[]>(() => {
    const list: RequestStep[] = [
      {
        id: 'basics',
        short: t('requestSteps.basics.short'),
        title: t('requestSteps.basics.title'),
        body: t('requestSteps.basics.body'),
        icon: ClipboardList,
      },
    ];
    if (hasAttributeSection) {
      list.push({
        id: 'details',
        short: t('requestSteps.details.short'),
        title: t('requestSteps.details.title'),
        body: t('requestSteps.details.body'),
        icon: Sparkles,
      });
    }
    list.push(
      {
        id: 'schedule',
        short: t('requestSteps.schedule.short'),
        title: t('requestSteps.schedule.title'),
        body: t('requestSteps.schedule.body'),
        icon: CalendarDays,
      },
      {
        id: 'review',
        short: t('requestSteps.review.short'),
        title: t('requestSteps.review.title'),
        body: t('requestSteps.review.body'),
        icon: CheckCircle2,
      },
    );
    return list;
  }, [hasAttributeSection, t]);

  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === stepId));
  const currentStep = steps[currentIndex] ?? steps[0];

  useEffect(() => {
    if (!steps.some((step) => step.id === stepId)) {
      setStepId('basics');
      setStepError(null);
    }
  }, [stepId, steps]);

  function isAttributeFilled(attribute: any) {
    const value = attributeValues[attribute.id];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  function getStepError(id: RequestStepId): string | null {
    if (id === 'basics') {
      if (!form.serviceId) return t('requestSteps.error.service');
      if (!form.title.trim()) return t('requestSteps.error.title');
      if (!form.description.trim()) return t('requestSteps.error.description');
    }
    if (id === 'details') {
      const missing = openAttributes.find((attribute) => attribute.isRequired && !isAttributeFilled(attribute));
      if (missing) return t('requestSteps.error.details', { name: missing.name });
    }
    if (id === 'schedule' && budgetInverted) {
      return t('requests.new.budgetInverted');
    }
    return null;
  }

  function moveToStep(id: RequestStepId) {
    setStepId(id);
    setStepError(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    const message = getStepError(currentStep.id);
    if (message) {
      setStepError(message);
      return;
    }
    const next = steps[currentIndex + 1];
    if (next) moveToStep(next.id);
  }

  function goBack() {
    const previous = steps[currentIndex - 1];
    if (previous) moveToStep(previous.id);
  }

  const budgetLabel =
    budgetMin !== null && budgetMax !== null
      ? t('requests.new.budgetRange', {
          min: budgetMin.toLocaleString(),
          max: budgetMax.toLocaleString(),
        })
      : budgetMax !== null
        ? t('requests.new.budgetUpTo', { max: budgetMax.toLocaleString() })
        : budgetMin !== null
          ? t('requests.new.budgetFrom', { min: budgetMin.toLocaleString() })
          : t('requests.new.budgetUnspecified');

  // What the AI assistant still has to ask about: only required fields
  // that are genuinely empty right now.
  const assistantFilledFields = useMemo(
    () => [
      ...(form.serviceId ? (['service'] as const) : []),
      ...(form.title.trim() ? (['title'] as const) : []),
      ...(form.description.trim() ? (['description'] as const) : []),
    ],
    [form.serviceId, form.title, form.description],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Enter inside a field should advance the wizard, never send the request
    // before the client has seen the review step.
    if (currentStep.id !== 'review') {
      goNext();
      return;
    }

    const invalidId = VALIDATED_STEPS.find(
      (id) => steps.some((step) => step.id === id) && getStepError(id),
    );
    if (invalidId) {
      setStepId(invalidId);
      setStepError(getStepError(invalidId));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    try {
      // Provider-set features are always included; the client's own answers
      // take precedence on any attribute they both touch (they can't edit
      // the pinned ones, but defensive ordering costs nothing).
      const mergedValues = { ...providerSetValues, ...attributeValues };
      const request = await requestsApi.create({
        serviceId: form.serviceId,
        providerId,
        serviceOfferingId,
        isPublic: providerId ? openToOthers || undefined : undefined,
        attributeValues: Object.keys(mergedValues).length ? mergedValues : undefined,
        title: form.title,
        description: form.description,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
        additionalNotes: form.additionalNotes || undefined,
      });
      router.push(`/requests/${request.id}?sent=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('requests.new.errorCreate'));
    } finally {
      setLoading(false);
    }
  }

  const selectedServiceName =
    offeringTitleByService.get(form.serviceId) ??
    availableServices.find((service) => service.id === form.serviceId)?.name ??
    '—';
  const whenLabel = form.preferredDate
    ? new Date(form.preferredDate).toLocaleDateString() +
      (form.preferredTime ? `, ${form.preferredTime}` : '')
    : t('requests.new.flexible');
  const reviewProviderName = provider?.businessName ?? t('requests.new.selectedProvider');

  const StepIcon = currentStep.icon;

  return (
    <div className="page-narrow py-8">
      <PageHeader
        eyebrow={t('requests.new.eyebrow')}
        title={t('requests.new.title')}
        description={
          providerId ? t('requests.new.directed') : t('requests.new.open')
        }
      />

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3 text-xs leading-relaxed text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <p>{t('requestSteps.freeNote')}</p>
      </div>

      <StepRail steps={steps} currentIndex={currentIndex} />

      <form onSubmit={onSubmit}>
        <Panel bodyClassName="p-0" className="overflow-hidden">
          <div className="border-b border-ink-100 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <StepIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="eyebrow-muted">
                  {t('requestSteps.step', {
                    current: String(currentIndex + 1),
                    total: String(steps.length),
                  })}
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-ink-950">{currentStep.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{currentStep.body}</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {stepError && (
              <div className="alert alert-error mb-5" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {stepError}
              </div>
            )}

            {error && currentStep.id === 'review' && (
              <div className="alert alert-error mb-5" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            {currentStep.id === 'basics' && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="service" className="label">
                    {t('requests.new.service')}
                  </label>
                  <select
                    id="service"
                    required
                    disabled={!!serviceOfferingId || (providerServiceIds?.size === 0)}
                    className="select-lg"
                    value={form.serviceId}
                    onChange={(e) => {
                      markEdited('serviceId');
                      setStepError(null);
                      setForm({ ...form, serviceId: e.target.value });
                    }}
                  >
                    <option value="">{t('requests.new.selectService')}</option>
                    {availableServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {offeringTitleByService.get(s.id) ??
                          (s.category?.name ? `${s.category.name} — ${s.name}` : s.name)}
                      </option>
                    ))}
                  </select>
                  {serviceOfferingId && (
                    <p className="mt-1.5 text-xs text-ink-500">
                      {t('requests.new.fixedByOffering')}{' '}
                      <Link href="/search" className="text-link">
                        {t('requests.new.changeService')}
                      </Link>
                    </p>
                  )}
                  {!serviceOfferingId && providerId && providerServiceIds && (
                    <p className="mt-1.5 text-xs text-ink-500">
                      {availableServices.length === 0
                        ? t('requests.new.noServices')
                        : t('requests.new.onlyServices', {
                            name: provider?.businessName ?? t('requests.new.selectedProvider'),
                          })}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="title" className="label">
                      {t('requests.new.titleLabel')}
                    </label>
                    <span className="text-2xs tabular text-ink-400">
                      {form.title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  <input
                    id="title"
                    required
                    maxLength={TITLE_MAX}
                    placeholder={t('requests.new.titlePlaceholder')}
                    value={form.title}
                    onChange={(e) => {
                      markEdited('title');
                      setStepError(null);
                      setForm({ ...form, title: e.target.value });
                    }}
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="description" className="label">
                      {t('requests.new.descLabel')}
                    </label>
                    <span className="text-2xs tabular text-ink-400">
                      {form.description.length}/{DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="description"
                    required
                    maxLength={DESCRIPTION_MAX}
                    rows={5}
                    placeholder={t('requests.new.descPlaceholder')}
                    value={form.description}
                    onChange={(e) => {
                      markEdited('description');
                      setStepError(null);
                      setForm({ ...form, description: e.target.value });
                    }}
                  />
                  <p className="mt-1.5 text-xs text-ink-500">{t('requests.new.describeJobHint')}</p>
                </div>

                <details className="group rounded-xl border border-ink-200 bg-ink-50/40">
                  <summary className="flex cursor-pointer list-none items-center gap-2 p-3.5 text-sm font-bold text-ink-800 [&::-webkit-details-marker]:hidden">
                    <Sparkles className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {t('requestSteps.assistant')}
                    <ChevronDown
                      className="ml-auto h-4 w-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="border-t border-ink-200 p-3.5">
                    <BookingAssistant
                      serviceId={form.serviceId || undefined}
                      filledFields={assistantFilledFields}
                      onApply={applyBookingFields}
                    />
                  </div>
                </details>
              </div>
            )}

            {currentStep.id === 'details' && (
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-ink-500">
                  {providerName
                    ? t('requests.new.moreDetailsHintDirected', { name: providerName })
                    : t('requests.new.moreDetailsHintOpen')}
                </p>

                {fixedFeatures.length > 0 && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-brand-800">
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t('requests.new.includedWithOffering', {
                        name: providerName ?? t('requests.new.selectedProvider'),
                      })}
                    </p>
                    <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                      {fixedFeatures.map((f: any) => (
                        <div
                          key={f.id}
                          className="flex items-baseline justify-between gap-3 border-b border-brand-100 pb-2"
                        >
                          <dt className="text-xs text-ink-500">{f.label}</dt>
                          <dd className="text-right text-xs font-semibold text-ink-900">{f.display}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {openAttributes.length > 0 && (
                  <div className="space-y-5">
                    {form.serviceId && (
                      <AiRequestAssist serviceId={form.serviceId} onApply={applySuggestion} />
                    )}
                    <DynamicAttributeForm
                      attributes={openAttributes}
                      values={attributeValues}
                      onChange={(id, value) => {
                        markEdited(`attr:${id}`);
                        setStepError(null);
                        setAttributeValues((prev) => ({ ...prev, [id]: value }));
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep.id === 'schedule' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="date" className="label">
                      {t('requests.new.preferredDate')}
                    </label>
                    <input
                      id="date"
                      type="date"
                      value={form.preferredDate}
                      onChange={(e) => {
                        markEdited('preferredDate');
                        setStepError(null);
                        setForm({ ...form, preferredDate: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="time" className="label">
                      {t('requests.new.preferredTime')}
                    </label>
                    <input
                      id="time"
                      type="time"
                      value={form.preferredTime}
                      onChange={(e) => {
                        markEdited('preferredTime');
                        setStepError(null);
                        setForm({ ...form, preferredTime: e.target.value });
                      }}
                    />
                  </div>
                </div>

                <fieldset>
                  <legend className="label">{t('requests.new.budget')}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="budget-min" className="sr-only">
                        {t('requests.new.budgetMinAria')}
                      </label>
                      <input
                        id="budget-min"
                        type="number"
                        min={0}
                        placeholder={t('requests.new.minimum')}
                        className="tabular"
                        value={form.budgetMin}
                        onChange={(e) => {
                          markEdited('budgetMin');
                          setStepError(null);
                          setForm({ ...form, budgetMin: e.target.value });
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="budget-max" className="sr-only">
                        {t('requests.new.budgetMaxAria')}
                      </label>
                      <input
                        id="budget-max"
                        type="number"
                        min={0}
                        placeholder={t('requests.new.maximum')}
                        className="tabular"
                        value={form.budgetMax}
                        onChange={(e) => {
                          markEdited('budgetMax');
                          setStepError(null);
                          setForm({ ...form, budgetMax: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                  {budgetInverted ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t('requests.new.budgetInverted')}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-ink-500">{t('requests.new.budgetHint')}</p>
                  )}
                </fieldset>

                <div>
                  <label htmlFor="notes" className="label">
                    {t('requests.new.notes')}{' '}
                    <span className="font-normal text-ink-400">{t('requests.new.optional')}</span>
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    placeholder={t('requests.new.notesPlaceholder')}
                    value={form.additionalNotes}
                    onChange={(e) => {
                      markEdited('additionalNotes');
                      setStepError(null);
                      setForm({ ...form, additionalNotes: e.target.value });
                    }}
                  />
                </div>
              </div>
            )}

            {currentStep.id === 'review' && (
              <div className="space-y-6">
                <div className="rounded-xl border border-ink-200 bg-ink-50/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-bold text-ink-950">
                      {t('requests.new.summary')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => moveToStep('basics')}
                      className="btn-link text-xs"
                    >
                      {t('requestSteps.edit')}
                    </button>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-ink-500">{t('requests.new.summaryService')}</dt>
                      <dd className="text-right font-semibold text-ink-900">{selectedServiceName}</dd>
                    </div>
                    {providerId && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-ink-500">{t('requests.new.sentTo')}</dt>
                        <dd className="text-right font-semibold text-ink-900">{reviewProviderName}</dd>
                      </div>
                    )}
                    {providerId && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-ink-500">{t('requests.new.competition')}</dt>
                        <dd className="text-right font-semibold text-ink-900">
                          {openToOthers ? t('requests.new.openToOthers') : t('requests.new.private')}
                        </dd>
                      </div>
                    )}
                    <div className="border-t border-ink-100 pt-3">
                      <dt className="text-xs font-bold text-ink-500">{t('requests.new.titleLabel')}</dt>
                      <dd className="mt-1 font-semibold text-ink-900">{form.title || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-ink-500">{t('requests.new.descLabel')}</dt>
                      <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-600">
                        {form.description || '—'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3 border-t border-ink-100 pt-3">
                      <dt className="shrink-0 text-ink-500">{t('requests.new.when')}</dt>
                      <dd className="text-right font-semibold text-ink-900">{whenLabel}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="flex shrink-0 items-center gap-1.5 text-ink-500">
                        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('requests.new.budgetLabel')}
                      </dt>
                      <dd className="tabular text-right font-semibold text-ink-900">{budgetLabel}</dd>
                    </div>
                    {form.additionalNotes && (
                      <div>
                        <dt className="text-xs font-bold text-ink-500">{t('requests.new.notes')}</dt>
                        <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-600">
                          {form.additionalNotes}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <p className="eyebrow-muted mb-2.5">{t('requests.new.beforeYouSend')}</p>
                  <ul className="space-y-2">
                    {checklist.map((c) => (
                      <li key={c.label} className="flex items-center gap-2 text-sm">
                        {c.done ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                        ) : (
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border-2 border-ink-200"
                            aria-hidden="true"
                          />
                        )}
                        <span className={c.done ? 'text-ink-600' : 'text-ink-500'}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {providerId && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-200 p-3.5 transition-colors hover:bg-ink-50/60">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                      checked={openToOthers}
                      onChange={(e) => setOpenToOthers(e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                        {t('requests.new.openToOthers')}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-relaxed text-ink-500">
                        {t('requests.new.privacyNoteStart', { name: reviewProviderName })}{' '}
                        <span className="font-semibold text-ink-600">
                          {t('requests.new.privacyNoteBold')}
                        </span>{' '}
                        {t('requests.new.privacyNoteTail')}
                      </span>
                    </span>
                  </label>
                )}

                <p className="text-2xs leading-relaxed text-ink-500">
                  {providerId
                    ? openToOthers
                      ? t('requests.new.footerDirectedOpen', { name: reviewProviderName })
                      : t('requests.new.footerDirectedPrivate', { name: reviewProviderName })
                    : t('requests.new.footerOpen')}
                </p>

                <BookingPath />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-ink-100 bg-ink-50/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {currentIndex > 0 ? (
              <button type="button" onClick={goBack} className="btn-secondary w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t('requestSteps.back')}
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}

            {currentStep.id === 'review' ? (
              <button disabled={loading || !ready} className="btn-primary w-full sm:w-auto" type="submit">
                <Send className="h-4 w-4" aria-hidden="true" />
                {loading ? t('requests.new.sending') : t('requests.new.send')}
              </button>
            ) : (
              <button type="button" onClick={goNext} className="btn-primary w-full sm:w-auto">
                {t('requestSteps.continue')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </Panel>
      </form>
    </div>
  );
}

// Mirrors the offering detail page's formatter: the typed
// ServiceOfferingAttributeValue columns collapse to a display string the same
// way everywhere (Yes/No, joined MULTI_SELECT, number, or text).
function offeringValueDisplay(v: any, format: (key: MessageKey) => string): string | null {
  if (v.booleanValue !== null) return v.booleanValue ? format('requests.new.yes') : format('requests.new.no');
  if (v.jsonValue?.length) return v.jsonValue.join(', ');
  if (v.numberValue !== null) return String(v.numberValue);
  return v.textValue ?? null;
}

export default function NewServiceRequestPage() {
  return (
    <Suspense fallback={null}>
      <NewServiceRequestForm />
    </Suspense>
  );
}
