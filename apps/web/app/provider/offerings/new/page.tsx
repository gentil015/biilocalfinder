'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, categoriesApi, offeringsApi, servicesApi } from '@/lib/api';
import { DynamicAttributeForm } from '@/components/attributes/dynamic-attribute-form';
import { PageHeader, Panel } from '@/components/ui/page';

export default function NewServiceOfferingPage() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState('');
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

  useEffect(() => {
    servicesApi.list().then(setServices).catch(() => setServices([]));
  }, []);

  // Fetch the category's attribute definitions the moment a service is
  // picked — this is what makes the form generate itself with no
  // per-category frontend code (spec §10).
  useEffect(() => {
    setAttributeValues({});
    const service = services.find((s) => s.id === serviceId);
    if (!service?.category?.id) {
      setAttributes([]);
      return;
    }
    categoriesApi.attributes(service.category.id).then(setAttributes).catch(() => setAttributes([]));
  }, [serviceId, services]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceId) {
      setError('Please choose a service.');
      return;
    }
    setLoading(true);
    try {
      const offering = await offeringsApi.create({
        serviceId,
        title: form.title || undefined,
        description: form.description || undefined,
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        priceType: form.priceType,
        duration: form.duration || undefined,
        attributeValues,
      });
      router.push(`/provider/offerings?created=${offering.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create service offering');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-narrow py-6 pb-28 md:py-8">
      <PageHeader
        eyebrow="Services"
        title="Add a service"
        description="Tell clients about this service — the details below adjust automatically based on what you pick."
      />

      <form onSubmit={onSubmit}>
        <Panel title="Choose a service" className="mb-4">
          <div className="field">
            <label htmlFor="offering-service" className="label">
              Service
            </label>
            <select
              id="offering-service"
              required
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category?.name ? `${s.category.name} — ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>
        </Panel>

        <Panel title="Describe it" className="mb-4">
          <div className="field">
            <label htmlFor="offering-title" className="label">
              Title <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="offering-title"
              placeholder="e.g. Wedding Photography"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="field mb-0 mt-4">
            <label htmlFor="offering-description" className="label">
              Description
            </label>
            <textarea
              id="offering-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </Panel>

        <Panel title="Pricing & time" className="mb-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="offering-price" className="label">
                Base price (RWF)
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
                Price type
              </label>
              <select
                id="offering-price-type"
                value={form.priceType}
                onChange={(e) => setForm({ ...form, priceType: e.target.value })}
              >
                <option value="FIXED">Fixed</option>
                <option value="HOURLY">Hourly</option>
                <option value="PER_DAY">Per day</option>
                <option value="STARTING_FROM">Starting from</option>
                <option value="CUSTOM_QUOTE">Custom quote</option>
              </select>
            </div>
          </div>
          <div className="field mb-0 mt-4">
            <label htmlFor="offering-duration" className="label">
              Duration <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="offering-duration"
              placeholder="e.g. 2 hours, half day"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </div>
        </Panel>

        {attributes.length > 0 && (
          <Panel title="Tell clients about your service" description="Details specific to the category you chose." className="mb-4">
            <DynamicAttributeForm
              attributes={attributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />
          </Panel>
        )}

        {/* Sticky submit — stays within reach while the category attributes
            grow the form well past a screenful. */}
        <div className="sticky bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-10 rounded-xl border border-ink-200 bg-surface/90 p-3 shadow-xs backdrop-blur-xl md:bottom-0">
          {error && (
            <p className="error-text mb-3" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
            {loading ? 'Saving…' : 'Add service'}
          </button>
        </div>
      </form>
    </main>
  );
}