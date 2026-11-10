import type { LucideIcon } from 'lucide-react';

export function AtAGlanceRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-100">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-ink-800">{children}</div>
      </div>
    </li>
  );
}
