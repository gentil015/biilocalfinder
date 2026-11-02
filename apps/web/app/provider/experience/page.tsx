'use client';

import { useI18n } from '@/components/locale-provider';
import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApiError,
  professionalProfileApi,
  type ExperienceInput,
  type ProviderExperience,
} from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock, StatCard } from '@/components/ui/page';
import { ProviderProfileNav } from '@/components/provider-profile-nav';

const EMPTY_FORM = {
  title: '',
  organization: '',
  location: '',
  startMonth: '',
  endMonth: '',
  isCurrent: false,
  description: '',
};

type FormState = typeof EMPTY_FORM;

function monthToIso(value: string): string | undefined {
  return value ? `${value}-01` : undefined;
}

function isoToMonth(value: string | null): string {
  return value ? value.slice(0, 7) : '';
}

function monthLabel(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function rangeLabel(item: ProviderExperience): string {
  const start = monthLabel(item.startDate) || '—';
  if (item.isCurrent) return `${start} — Present`;
  const end = monthLabel(item.endDate) || 'Present';
  return `${start} — ${end}`;
}

export default function ProviderExperiencePage() {
  const { translateMessage: tr } = useI18n();
  const [items, setItems] = useState<ProviderExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () =>
    professionalProfileApi
      .listExperience()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your experience'))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const currentRole = items.find((item) => item.isCurrent);
  const organizations = useMemo(
    () => new Set(items.map((item) => item.organization.trim().toLowerCase())).size,
    [items],
  );

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setEditorOpen(true);
  }

  function openEdit(item: ProviderExperience) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      organization: item.organization,
      location: item.location ?? '',
      startMonth: isoToMonth(item.startDate),
      endMonth: isoToMonth(item.endDate),
      isCurrent: item.isCurrent,
      description: item.description ?? '',
    });
    setError(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.organization.trim() || !form.startMonth) {
      setError('Add a title, organization and start date.');
      return;
    }
    if (!form.isCurrent && form.endMonth && form.endMonth < form.startMonth) {
      setError('The end date cannot be before the start date.');
      return;
    }

    const payload: ExperienceInput = {
      title: form.title.trim(),
      organization: form.organization.trim(),
      location: form.location.trim() || undefined,
      startDate: monthToIso(form.startMonth)!,
      endDate: form.isCurrent ? null : monthToIso(form.endMonth) ?? null,
      isCurrent: form.isCurrent,
      description: form.description.trim() || undefined,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await professionalProfileApi.updateExperience(editingId, payload);
      } else {
        await professionalProfileApi.createExperience(payload);
      }
      closeEditor();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this experience');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: ProviderExperience) {
    if (!window.confirm(`Remove "${item.title} at ${item.organization}" from your profile?`)) return;
    setDeletingId(item.id);
    try {
      await professionalProfileApi.removeExperience(item.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this experience');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page-narrow py-6 pb-24 md:py-8">
      <PageHeader
        eyebrow={tr("Professional profile")}
        title={tr("Experience")}
        description={tr("Your work history. Clients see this on your public profile, so keep it short and specific.")}
        actions={
          <button type="button" onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {tr("Add experience")}
          </button>
        }
      />

      <ProviderProfileNav className="mb-6" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={BriefcaseBusiness} label={tr("Entries")} value={String(items.length)} />
        <StatCard icon={Sparkles} label={tr("Current role")} value={currentRole ? 'Active' : '—'} sub={currentRole?.title} tone="brand" />
        <StatCard icon={CalendarDays} label={tr("Organizations")} value={String(organizations)} />
      </div>

      {editorOpen && (
        <Panel
          title={editingId ? 'Edit experience' : 'Add experience'}
          description={tr("Dates use month and year — they are shown the same way on your public profile.")}
          className="mb-6"
          actions={
            <button type="button" onClick={closeEditor} className="btn-ghost btn-sm" aria-label={tr("Close editor")}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          }
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="exp-title" className="label">
                  {tr("Job title")}
                </label>
                <input
                  id="exp-title"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder={tr("e.g. Senior electrician")}
                  maxLength={120}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="exp-org" className="label">
                  {tr("Organization")}
                </label>
                <input
                  id="exp-org"
                  value={form.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder={tr("e.g. Kigali Power Ltd")}
                  maxLength={160}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="exp-location" className="label">
                {tr("Location")} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
              </label>
              <input
                id="exp-location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder={tr("e.g. Kigali, Rwanda")}
                maxLength={160}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="exp-start" className="label">
                  {tr("Start date")}
                </label>
                <input
                  id="exp-start"
                  type="month"
                  value={form.startMonth}
                  onChange={(e) => update('startMonth', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="exp-end" className="label">
                  {tr("End date")}
                </label>
                <input
                  id="exp-end"
                  type="month"
                  value={form.endMonth}
                  onChange={(e) => update('endMonth', e.target.value)}
                  disabled={form.isCurrent}
                  className={form.isCurrent ? 'opacity-50' : ''}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.isCurrent}
                onChange={(e) => update('isCurrent', e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink-900">{tr("I currently work here")}</span>
                <span className="block text-2xs text-ink-500">{tr("The end date stays open (“Present”).")}</span>
              </span>
            </label>

            <div className="field">
              <label htmlFor="exp-description" className="label">
                {tr("Description")} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
              </label>
              <textarea
                id="exp-description"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder={tr("What did you do, and what were you responsible for?")}
                maxLength={2000}
              />
              <p className="hint">
                <span className="tabular">{form.description.length}/2000</span>
              </p>
            </div>

            {error && (
              <p className="error-text" role="alert">
                {tr(error)}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditor} className="btn-secondary" disabled={saving}>
                {tr("Cancel")}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Check className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add experience'}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {loading && <LoadingBlock label={tr("Loading your experience…")} />}

      {!loading && !editorOpen && error && (
        <p className="alert alert-error mb-4" role="alert">
          {tr(error)}
        </p>
      )}

      {!loading && items.length === 0 && !editorOpen && (
        <EmptyState
          icon={BriefcaseBusiness}
          title={tr("No experience added yet")}
          body="Add your roles and projects so clients can see what you have done before."
          action={
            <button type="button" onClick={openAdd} className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {tr("Add your first role")}
            </button>
          }
        />
      )}

      {!loading && items.length > 0 && (
        <ol className="relative space-y-3 sm:space-y-4">
          <span
            className="absolute bottom-6 left-[1.125rem] top-6 w-px bg-gradient-to-b from-brand-200 via-ink-200 to-transparent sm:left-[1.25rem]"
            aria-hidden="true"
          />
          {items.map((item) => (
            <li key={item.id} className="relative">
              <article className="surface-card group relative ml-11 overflow-hidden p-4 transition hover:border-brand-200 hover:shadow-md sm:ml-14 sm:p-5">
                <span className="absolute -left-11 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 sm:-left-14 sm:h-10 sm:w-10">
                  <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                </span>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold tracking-tight text-ink-950 sm:text-base">{item.title}</h2>
                      {item.isCurrent && <span className="badge badge-success">{tr("Current")}</span>}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-ink-700">{item.organization}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {rangeLabel(item)}
                      </span>
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.location}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="btn-ghost btn-sm"
                      aria-label={`Edit ${item.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sm:sr-only">{tr("Edit")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(item)}
                      disabled={deletingId === item.id}
                      className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sm:sr-only">{tr("Delete")}</span>
                    </button>
                  </div>
                </div>

                {item.description && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.description}</p>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
