'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MailCheck, PhoneCall, Search, Users } from 'lucide-react';
import { adminApi, type AdminUser, type AdminUsersPage } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, LoadingBlock, PageHeader, Panel } from '@/components/ui/page';

const ROLES: { label: string; value: AdminUser['role'] | '' }[] = [
  { label: 'All roles', value: '' },
  { label: 'Client', value: 'CLIENT' },
  { label: 'Provider', value: 'PROVIDER' },
  { label: 'Admin', value: 'ADMIN' },
];

const STATUSES: { label: string; value: AdminUser['status'] | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Deactivated', value: 'DEACTIVATED' },
  { label: 'Pending verification', value: 'PENDING_VERIFICATION' },
];

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<AdminUser['role'] | ''>('');
  const [status, setStatus] = useState<AdminUser['status'] | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUsersPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .users({ search, role: role || undefined, status: status || undefined, page })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load users');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, role, status, page, refresh]);

  async function changeStatus(user: AdminUser) {
    const nextStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (
      nextStatus === 'SUSPENDED' &&
      !window.confirm(`Suspend ${user.firstName} ${user.lastName}? They will lose access to their account.`)
    ) {
      return;
    }

    setBusyUserId(user.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await adminApi.setUserStatus(user.id, nextStatus);
      setNotice(`${updated.firstName} ${updated.lastName} is now ${nextStatus.toLowerCase()}.`);
      setRefresh((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this account');
    } finally {
      setBusyUserId(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Accounts"
        title="User management"
        description="Find platform accounts, review their details, and manage access. Providers show their business and verification state at a glance."
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-success mb-4" role="status">
          {notice}
        </div>
      )}

      <Panel className="mb-5" bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_14rem]">
          <label className="relative block">
            <span className="sr-only">Search by name, email, or phone</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, or phone"
              className="w-full pl-9"
            />
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <select
              value={role}
              onChange={(event) => {
                setPage(1);
                setRole(event.target.value as AdminUser['role'] | '');
              }}
              className="w-full"
            >
              {ROLES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by account status</span>
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as AdminUser['status'] | '');
              }}
              className="w-full"
            >
              {STATUSES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {loading && <LoadingBlock label="Loading users…" />}

      {!loading && data?.items.length === 0 && (
        <EmptyState
          icon={Users}
          title="No users found"
          body="Try a different search term or change the role and status filters."
        />
      )}

      {!loading && data && data.items.length > 0 && (
        <Panel
          title={`${data.total.toLocaleString()} ${data.total === 1 ? 'user' : 'users'}`}
          description={`Page ${data.page} of ${totalPages}`}
          bodyClassName="p-0"
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col" className="w-24">Role</th>
                  <th scope="col">Provider</th>
                  <th scope="col" className="w-40">Status</th>
                  <th scope="col" className="w-32">Joined</th>
                  <th scope="col" className="w-56 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const isAdmin = user.role === 'ADMIN';
                  const canSuspend = user.status === 'ACTIVE';
                  const canActivate = user.status === 'SUSPENDED';
                  const primaryProvider = user.providers[0] ?? null;
                  return (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/users/${user.id}`} className="block font-semibold text-ink-900 hover:text-brand-700">
                          {user.firstName} {user.lastName}
                        </Link>
                        <span className="flex items-center gap-1.5 text-xs text-ink-500">
                          {user.email}
                          {user.emailVerified && (
                            <MailCheck className="h-3 w-3 text-success-600" aria-label="Email verified" />
                          )}
                        </span>
                        {user.phone && (
                          <span className="flex items-center gap-1.5 text-xs text-ink-400">
                            {user.phone}
                            {user.phoneVerified && (
                              <PhoneCall className="h-3 w-3 text-success-600" aria-label="Phone verified" />
                            )}
                          </span>
                        )}
                      </td>
                      <td className="text-sm capitalize text-ink-600">{user.role.toLowerCase()}</td>
                      <td>
                        {primaryProvider ? (
                          <div className="min-w-0">
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="block truncate text-sm font-medium text-ink-800 hover:text-brand-700"
                            >
                              {primaryProvider.businessName}
                            </Link>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-2xs uppercase tracking-wide text-ink-500">
                                {primaryProvider.providerType ?? 'No type'}
                              </span>
                              <StatusBadge status={primaryProvider.verificationStatus} />
                            </span>
                            {user.providers.length > 1 && (
                              <span className="block text-2xs text-ink-400">
                                +{user.providers.length - 1} more workspace{user.providers.length - 1 === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">Not a provider</span>
                        )}
                      </td>
                      <td><StatusBadge status={user.status} /></td>
                      <td className="whitespace-nowrap text-sm text-ink-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/users/${user.id}`} className="btn-secondary btn-sm whitespace-nowrap">
                            Manage
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                          {isAdmin ? (
                            <span className="text-xs text-ink-400">Protected</span>
                          ) : canSuspend || canActivate ? (
                            <button
                              type="button"
                              onClick={() => void changeStatus(user)}
                              disabled={busyUserId !== null}
                              className={canSuspend ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                            >
                              {busyUserId === user.id
                                ? 'Updating…'
                                : canSuspend
                                  ? 'Suspend'
                                  : 'Reactivate'}
                            </button>
                          ) : (
                            <span className="text-xs text-ink-400">No access action</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="text-sm tabular text-ink-500">
                {data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}
