'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ListPlus, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { adminCategoriesApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';

const TYPES = ['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'PRICE'];
const OPTION_TYPES = ['SELECT', 'MULTI_SELECT'];

export default function AdminCategoryAttributesPage() {
  const { id } = useParams<{ id: string }>();
  const [attributes, setAttributes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('TEXT');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newFilterable, setNewFilterable] = useState(false);

  function load() {
    adminCategoriesApi
      .attributesForAdmin(id)
      .then(setAttributes)
      .catch(() => setError('Unable to load attributes'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function addAttribute(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await adminCategoriesApi.createAttribute(id, {
        name: newName,
        type: newType,
        isRequired: newRequired,
        isFilterable: newFilterable,
        options: OPTION_TYPES.includes(newType)
          ? newOptions.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined,
      });
      setNewName('');
      setNewOptions('');
      setNewRequired(false);
      setNewFilterable(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add attribute');
    }
  }

  async function remove(attributeId: string) {
    await adminCategoriesApi.removeAttribute(attributeId);
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    const reordered = [...attributes];
    const target = index + direction;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setAttributes(reordered);
    await adminCategoriesApi.reorderAttributes(id, reordered.map((a) => a.id));
  }

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading attributes…" />
      </main>
    );
  }

  return (
    <main className="page-workspace py-6 md:py-8">
      <BackButton variant="link" label="All categories" fallbackHref="/admin/categories" className="mb-3" />

      <PageHeader
        eyebrow="Admin · Category"
        title="Attributes"
        description="The fields providers fill in for a listing and the facets clients filter on. Order here is the order they appear in the form."
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel
          title="Fields"
          description={
            attributes.length > 0
              ? `${attributes.length} attribute${attributes.length === 1 ? '' : 's'} in display order.`
              : undefined
          }
          bodyClassName="p-0"
        >
          {attributes.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={ListPlus}
                title="No attributes yet"
                body="Add the first field to this category — providers will see it on their listing form and clients will see it as a filter."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="w-10">
                      <span className="sr-only">Order</span>
                    </th>
                    <th scope="col">Attribute</th>
                    <th scope="col" className="w-28">
                      Type
                    </th>
                    <th scope="col" className="w-44">
                      Behaviour
                    </th>
                    <th scope="col" className="w-28 text-right">
                      <span className="sr-only">Reorder and remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attributes.map((a, i) => (
                    <tr key={a.id}>
                      <td className="tabular text-xs font-semibold text-ink-400">{i + 1}</td>
                      <td className="max-w-[18rem]">
                        <p className="truncate text-sm font-semibold text-ink-950">{a.name}</p>
                        {!a.isActive && (
                          <p className="mt-0.5 text-xs text-ink-400">Disabled — hidden from providers</p>
                        )}
                      </td>
                      <td>
                        <span className="chip px-2 py-0.5 text-2xs font-semibold">
                          {a.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {a.isRequired && <span className="badge badge-brand">Required</span>}
                          {a.isFilterable && <span className="badge badge-info">Filterable</span>}
                          {!a.isRequired && !a.isFilterable && (
                            <span className="text-xs text-ink-400">Optional</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            className="icon-btn h-8 w-8 disabled:pointer-events-none disabled:opacity-30"
                            aria-label={`Move ${a.name} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === attributes.length - 1}
                            className="icon-btn h-8 w-8 disabled:pointer-events-none disabled:opacity-30"
                            aria-label={`Move ${a.name} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(a.id)}
                            className="icon-btn h-8 w-8 hover:bg-danger-50 hover:text-danger-600"
                            aria-label={`Remove ${a.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Add attribute" className="lg:sticky lg:top-6">
          <form onSubmit={addAttribute} className="space-y-4">
            <div className="field">
              <label className="label" htmlFor="attribute-name">
                Name
              </label>
              <input
                id="attribute-name"
                required
                placeholder="e.g. Drone available"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="attribute-type">
                Type
              </label>
              <select id="attribute-type" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {OPTION_TYPES.includes(newType) && (
              <div className="field">
                <label className="label" htmlFor="attribute-options">
                  Options
                </label>
                <input
                  id="attribute-options"
                  placeholder="Comma-separated, e.g. 4K, 6K, 8K"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                />
                <p className="hint">
                  <SlidersHorizontal className="mr-1 inline h-3 w-3" aria-hidden="true" />
                  Options become the filter choices clients see in search.
                </p>
              </div>
            )}

            <div className="space-y-1 border-t border-ink-100 pt-3">
              <label className="check-row" htmlFor="attribute-required">
                <input
                  id="attribute-required"
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                />
                <span>
                  <span className="block font-semibold text-ink-900">Required</span>
                  <span className="block text-xs text-ink-500">
                    Providers can&apos;t publish a listing without it.
                  </span>
                </span>
              </label>
              <label className="check-row" htmlFor="attribute-filterable">
                <input
                  id="attribute-filterable"
                  type="checkbox"
                  checked={newFilterable}
                  onChange={(e) => setNewFilterable(e.target.checked)}
                />
                <span>
                  <span className="block font-semibold text-ink-900">Filterable</span>
                  <span className="block text-xs text-ink-500">
                    Exposed as a facet on the search results page.
                  </span>
                </span>
              </label>
            </div>

            <button type="submit" className="btn-primary w-full">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add attribute
            </button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
