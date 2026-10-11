'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Layers, CornerDownRight, CircleSlash, ArrowRight } from 'lucide-react';
import { adminCategoriesApi } from '@/lib/api';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminCategoriesApi
      .listFlat()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="w-28">
                    Status
                  </th>
                  <th scope="col" className="w-40 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
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
                        className="btn-secondary btn-sm"
                        aria-label={`Manage attributes for ${c.name}`}
                      >
                        Attributes
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
