'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  GraduationCap,
  Pencil,
  Plus,
  School,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApiError,
  professionalProfileApi,
  type EducationInput,
  type ProviderEducation,
} from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock, StatCard } from '@/components/ui/page';
import { ProviderProfileNav } from '@/components/provider-profile-nav';

const EMPTY_FORM = {
  school: '',
  degree: '',
  fieldOfStudy: '',
  startMonth: '',
  endMonth: '',
  description: '',
};

type FormState = typeof EMPTY_FORM;

function monthToIso(value: string): string | null {
  return value ? `${value}-01` : null;
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

function rangeLabel(item: ProviderEducation): string {
  const start = monthLabel(item.startDate);
  const end = monthLabel(item.endDate);
  if (start && end) return `${start} — ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return 'Dates not set';
}

export default function ProviderEducationPage() {
  const [items, setItems] = useState<ProviderEducation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = () =>
    professionalProfileApi
      .listEducation()
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your education'))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const schools = useMemo(
    () => new Set(items.map((item) => item.school.trim().toLowerCase())).size,
    [items],
  );
  const fields = useMemo(
    () => new Set(items.map((item) => item.fieldOfStudy?.trim().toLowerCase()).filter(Boolean)).size,
    [items],
  );

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setEditorOpen(true);
  }

  function openEdit(item: ProviderEducation) {
    setEditingId(item.id);
    setForm({
      school: item.school,
      degree: item.degree ?? '',
      fieldOfStudy: item.fieldOfStudy ?? '',
      startMonth: isoToMonth(item.startDate),
      endMonth: isoToMonth(item.endDate),
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
    if (!form.school.trim()) {
      setError('Add the school or institution name.');
      return;
    }
    if (form.startMonth && form.endMonth && form.endMonth < form.startMonth) {
      setError('The end date cannot be before the start date.');
      return;
    }

    const payload: EducationInput = {
      school: form.school.trim(),
      degree: form.degree.trim() || undefined,
      fieldOfStudy: form.fieldOfStudy.trim() || undefined,
      startDate: monthToIso(form.startMonth),
      endDate: monthToIso(form.endMonth),
      description: form.description.trim() || undefined,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await professionalProfileApi.updateEducation(editingId, payload);
      } else {
        await professionalProfileApi.createEducation(payload);
      }
      closeEditor();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this education');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: ProviderEducation) {
    if (!window.confirm(`Remove "${item.school}" from your profile?`)) return;
    setDeletingId(item.id);
    try {
      await professionalProfileApi.removeEducation(item.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this education');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="page-narrow py-6 pb-24 md:py-8">
      <PageHeader
        eyebrow="Professional profile"
        title="Education"
        description="Schools, training and qualifications. Clients see this on your public profile next to your experience."
        actions={
          <button type="button" onClick={openAdd} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add education
          </button>
        }
      />

      <ProviderProfileNav className="mb-6" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={GraduationCap} label="Qualifications" value={String(items.length)} />
        <StatCard icon={School} label="Institutions" value={String(schools)} tone="brand" />
        <StatCard icon={BookOpen} label="Fields of study" value={String(fields)} />
      </div>

      {editorOpen && (
        <Panel
          title={editingId ? 'Edit education' : 'Add education'}
          description="Dates are optional. Add them when you want clients to see when you studied."
          className="mb-6"
          actions={
            <button type="button" onClick={closeEditor} className="btn-ghost btn-sm" aria-label="Close editor">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          }
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="field">
              <label htmlFor="edu-school" className="label">
                School or institution
              </label>
              <input
                id="edu-school"
                value={form.school}
                onChange={(e) => update('school', e.target.value)}
                placeholder="e.g. Kigali Institute of Science and Technology"
                maxLength={160}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="edu-degree" className="label">
                  Degree or certificate <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  id="edu-degree"
                  value={form.degree}
                  onChange={(e) => update('degree', e.target.value)}
                  placeholder="e.g. Diploma"
                  maxLength={160}
                />
              </div>
              <div className="field">
                <label htmlFor="edu-field" className="label">
                  Field of study <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  id="edu-field"
                  value={form.fieldOfStudy}
                  onChange={(e) => update('fieldOfStudy', e.target.value)}
                  placeholder="e.g. Electrical engineering"
                  maxLength={160}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="edu-start" className="label">
                  Start date <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  id="edu-start"
                  type="month"
                  value={form.startMonth}
                  onChange={(e) => update('startMonth', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="edu-end" className="label">
                  End date <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  id="edu-end"
                  type="month"
                  value={form.endMonth}
                  onChange={(e) => update('endMonth', e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="edu-description" className="label">
                Description <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <textarea
                id="edu-description"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Relevant modules, awards or training highlights."
                maxLength={2000}
              />
              <p className="hint">
                <span className="tabular">{form.description.length}/2000</span>
              </p>
            </div>

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditor} className="btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Check className="h-4 w-4" aria-hidden="true" />
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add education'}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {loading && <LoadingBlock label="Loading your education…" />}

      {!loading && !editorOpen && error && (
        <p className="alert alert-error mb-4" role="alert">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && !editorOpen && (
        <EmptyState
          icon={GraduationCap}
          title="No education added yet"
          body="Add a qualification or training programme to complete your professional profile."
          action={
            <button type="button" onClick={openAdd} className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add your first qualification
            </button>
          }
        />
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="surface-card group relative overflow-hidden p-4 transition hover:border-brand-200 hover:shadow-md sm:p-5"
            >
              <span
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-50 opacity-0 blur-2xl transition group-hover:opacity-100"
                aria-hidden="true"
              />
              <div className="relative flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold tracking-tight text-ink-950 sm:text-base">{item.school}</h2>
                  {(item.degree || item.fieldOfStudy) && (
                    <p className="mt-0.5 text-sm font-medium text-ink-700">
                      {[item.degree, item.fieldOfStudy].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-500">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {rangeLabel(item)}
                  </p>
                </div>
              </div>

              {item.description && (
                <p className="relative mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.description}</p>
              )}

              <div className="relative mt-4 flex items-center gap-1 border-t border-ink-100 pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="btn-ghost btn-sm"
                  aria-label={`Edit ${item.school}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(item)}
                  disabled={deletingId === item.id}
                  className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                  aria-label={`Delete ${item.school}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {deletingId === item.id ? 'Removing…' : 'Delete'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
