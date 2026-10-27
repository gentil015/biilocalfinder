import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, Circle, ListChecks, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Panel } from '@/components/ui/page';

export interface ProfileChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  minutes: string;
  icon: LucideIcon;
}

const QUICK_START_STEPS: QuickStartStep[] = [
  {
    id: 'SERVICES',
    title: 'List your first service',
    description: 'Pick a category and set a starting price so clients can find you.',
    href: '/provider/offerings/new',
    cta: 'Add service',
    minutes: '1 min',
    icon: Sparkles,
  },
  {
    id: 'LOCATION',
    title: 'Set where you work',
    description: 'Add your base area so nearby clients know you can reach them.',
    href: '/provider/service-areas',
    cta: 'Set location',
    minutes: '1 min',
    icon: Sparkles,
  },
  {
    id: 'AVAILABILITY',
    title: 'Add your weekly hours',
    description: 'Tick the days you work and the hours clients can book you.',
    href: '/provider/availability',
    cta: 'Set hours',
    minutes: '1 min',
    icon: Sparkles,
  },
  {
    id: 'PORTFOLIO',
    title: 'Add 3 photos of your work',
    description: 'Clients are far more likely to contact a provider with a portfolio.',
    href: '/provider/portfolio',
    cta: 'Add photos',
    minutes: '1 min',
    icon: Sparkles,
  },
  {
    id: 'PHONE_VERIFIED',
    title: 'Verify your phone',
    description: 'Earn a trust badge and get message alerts when clients contact you.',
    href: '/provider/verification',
    cta: 'Verify phone',
    minutes: '1 min',
    icon: Sparkles,
  },
];

export const CHECKLIST_HREF: Record<string, string> = {
  DESCRIPTION: '/provider/profile#description',
  PHONE_VERIFIED: '/provider/verification',
  LOCATION: '/provider/service-areas',
  SERVICES: '/provider/offerings',
  PORTFOLIO: '/provider/portfolio',
  AVAILABILITY: '/provider/availability',
  PRICING: '/provider/offerings',
};

const ACTION_HREF: Record<string, string> = {
  ADD_PORTFOLIO: '/provider/portfolio',
  ADD_SERVICES: '/provider/offerings/new',
  SET_AVAILABILITY: '/provider/availability',
  GET_VERIFIED: '/provider/verification',
  IMPROVE_CONVERSION: '/provider/portfolio',
};

export function isQuickStartComplete(checklist: ProfileChecklistItem[]): boolean {
  const checkedIds = new Set(checklist.filter((item) => item.checked).map((item) => item.id));
  return QUICK_START_STEPS.every((step) => checkedIds.has(step.id));
}

export function ProviderQuickStart({
  checklist,
  className = '',
}: {
  checklist: ProfileChecklistItem[];
  className?: string;
}) {
  if (checklist.length === 0) return null;

  const checkedIds = new Set(checklist.filter((item) => item.checked).map((item) => item.id));
  const doneCount = QUICK_START_STEPS.filter((step) => checkedIds.has(step.id)).length;
  const allDone = doneCount === QUICK_START_STEPS.length;
  const nextStep = QUICK_START_STEPS.find((step) => !checkedIds.has(step.id));
  const percent = Math.round((doneCount / QUICK_START_STEPS.length) * 100);

  return (
    <section className={`surface-card overflow-hidden ${className}`}>
      <div className="border-b border-ink-900/10 bg-gradient-to-br from-brand-50 to-surface px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Provider setup</p>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight text-ink-950">
              {allDone ? "You're ready to receive requests" : 'Set up in about 5 minutes'}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-ink-600">
              {allDone
                ? 'Your essential setup is complete. Add a description and pricing to help your profile rank higher.'
                : 'These five steps are everything a client needs to find you, trust you, and get in touch.'}
            </p>
          </div>
          <span
            className={`shrink-0 font-display text-2xl font-extrabold tabular ${
              allDone ? 'text-success-600' : 'text-brand-700'
            }`}
          >
            {doneCount}/{QUICK_START_STEPS.length}
          </span>
        </div>

        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-surface/80 ring-1 ring-inset ring-ink-900/5"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Provider setup progress"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              allDone ? 'bg-success-500' : 'bg-brand-600'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {!allDone && nextStep && (
          <Link href={nextStep.href} className="btn-primary mt-4">
            Continue: {nextStep.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {!allDone && (
        <ul className="divide-y divide-ink-100">
          {QUICK_START_STEPS.map((step, index) => {
            const done = checkedIds.has(step.id);
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={`group flex items-center gap-3.5 px-5 py-3.5 transition ${
                    done ? 'bg-success-50/30' : 'hover:bg-ink-50'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-300 text-2xs font-bold text-ink-500">
                      {index + 1}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-bold ${
                        done ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-950 group-hover:text-brand-700'
                      }`}
                    >
                      {step.title}
                    </span>
                    {!done && <span className="mt-0.5 block text-xs text-ink-500">{step.description}</span>}
                  </span>
                  {!done && (
                    <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-brand-700">
                      <span className="hidden text-ink-400 sm:inline">{step.minutes}</span>
                      <span className="flex items-center gap-0.5">
                        {step.cta}
                        <ChevronRight
                          className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProviderNextActions({
  actions,
  className = '',
}: {
  actions: { action: string; label: string }[];
  className?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <Panel
      className={className}
      title="Recommended next steps"
      description="Small improvements that help clients find and trust you."
    >
      <ul className="divide-y divide-ink-100">
        {actions.map((action) => {
          const href = ACTION_HREF[action.action];
          const content = (
            <>
              <ListChecks className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm text-ink-700">{action.label}</span>
              {href && (
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                  aria-hidden="true"
                />
              )}
            </>
          );

          return (
            <li key={action.action}>
              {href ? (
                <Link href={href} className="group flex items-center gap-2.5 py-3 first:pt-0 last:pb-0">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 py-3 first:pt-0 last:pb-0">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ChecklistLink({ item }: { item: ProfileChecklistItem }) {
  const href = CHECKLIST_HREF[item.id];
  const isDone = item.checked;

  return (
    <li className="flex items-center gap-2.5 text-sm">
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
      )}
      {isDone || !href ? (
        <span className={isDone ? 'text-ink-500' : 'font-medium text-ink-800'}>{item.label}</span>
      ) : (
        <Link href={href} className="group flex items-center gap-1 hover:underline">
          <span className="font-medium text-ink-800">{item.label}</span>
          <ChevronRight
            className="h-3.5 w-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
            aria-hidden="true"
          />
        </Link>
      )}
    </li>
  );
}
