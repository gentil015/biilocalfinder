'use client';

import { HelpCircle } from 'lucide-react';

export function HelpHint({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-ink-400 ${className}`} title={text}>
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">Help: </span>
      {text}
    </span>
  );
}
