'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Layers, CornerDownRight, CircleSlash, ArrowRight, Search } from 'lucide-react';
import { adminCategoriesApi } from '@/lib/api';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    adminCategoriesApi
      .listFlat()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    const nameById = new Map<string, string>(
      categories.map((category) => [category.id, category.name] as [string, string]),
    );
    return categories.filter((category) => {
      const parentName = category.parentId ? nameById.get(category.parentId) ?? '' : '';
      return `${category.name} ${parentName}`.toLowerCase().includes(needle);
    });
  }, [categories, query]);

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading categories…" />
      </main>
    );
  }

  const topLevel = categories.filter((c) => !c.parentId);
  const children = categories.length - topLevel.length;
  const disabled = categories.filter((c) => !c.isActive).length;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin"
        title="Categories"
        description="The taxonomy every service, request and search filter hangs off. Attributes on a category define the provider form and the facets clients filter on."
      />

      {categories.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={FolderTree} label="Categories" value={String(categories.length)} sub="Across the whole tree" />
          <StatCard icon={Layers} label="Top level" value={String(topLevel.length)} sub="Parent categories" />
          <StatCard icon={CornerDownRight} label="Subcategories" value={String(children)} sub="Nested under a parent" />
          <StatCard
            icon={CircleSlash}
            label="Disabled"
            tone={disabled > 0 ? 'warning' : 'neutral'}
            value={String(disabled)}
            sub="Hidden from clients"
          />
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          body="Categories are seeded from the API. Once they exist you can attach attributes to each one."
        />
      ) : (
        <Panel
          title="Category tree"
          description="Indented rows are subcategories — they inherit nothing, but they read as nested in search."
          bodyClassName="p-0"
        >
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                aria-label="Search categories"
                className="!pl-9"
              />
            </div>
            <p className="text-xs font-medium text-ink-500">
              {filtered.length} of {categories.length} categories
            </p>
          </div>
          <div className="table-wrap">
            <table className="table table-fixed">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="w-20 sm:w-28">
                    Status
                  </th>
                  <th scope="col" className="w-20 text-right sm:w-40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-ink-500">
                      No categories match “{query.trim()}”.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/admin/categories/${c.id}`}
                          className="group inline-flex max-w-full items-center gap-2"
                        >
                          {c.parentId && (
                            <CornerDownRight
                              className="h-3.5 w-3.5 shrink-0 text-ink-300"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`truncate text-sm font-semibold group-hover:text-brand-700 ${
                              c.parentId ? 'text-ink-600' : 'text-ink-950'
                            }`}
                          >
                            {c.name}
                          </span>
                        </Link>
                      </td>
                      <td>
                        {c.isActive ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-neutral">Disabled</span>
                        )}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/categories/${c.id}`}
                          className="btn-secondary btn-sm h-10 px-2 sm:h-8 sm:px-3"
                          aria-label={`Manage attributes for ${c.name}`}
                        >
                          <span className="hidden sm:inline">Attributes</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
