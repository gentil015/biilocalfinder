import type { LucideIcon } from 'lucide-react';

/**
 * Page header for every in-app screen. Keeping this in one place is what stops
 * the ~40 app pages from drifting apart in title size, spacing and eyebrow
 * treatment.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title mt-1">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Metric tile. Value is tabular so a row of stats stays aligned, and the icon
 * is decorative — the label carries the meaning.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'brand' | 'success' | 'warning';
}) {
  const toneClass = {
    neutral: 'text-ink-900',
    brand: 'text-brand-700',
    success: 'text-success-700',
    warning: 'text-warning-700',
  }[tone];

  const iconClass = {
    neutral: 'bg-ink-100 text-ink-500',
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
  }[tone];

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}
        <p className="stat-label truncate">{label}</p>
      </div>
      <p className={`font-display text-2xl font-extrabold tabular tracking-tight ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

/** Section wrapper with a title row — the base unit of every app page. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-5 sm:p-6',
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`surface-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/10 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Consistent empty/loading/error placeholder for in-app lists. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`empty-state ${className}`}>
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <p className="mt-4 text-sm font-bold text-ink-900">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * Shape-accurate placeholder. A spinner on a page that will hold a list makes
 * the layout jump twice (spinner, then content); a skeleton reserves the same
 * space, so content lands without reflow.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-xl ${className}`} />;
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm font-medium text-ink-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" aria-hidden="true" />
      {label}
    </div>
  );
}
