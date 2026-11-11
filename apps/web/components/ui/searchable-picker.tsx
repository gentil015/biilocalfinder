'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
  keywords?: string;
}

function highlightMatch(label: string, query: string) {
  const needle = query.trim();
  if (!needle) return label;
  const index = label.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return label;
  return (
    <>
      {label.slice(0, index)}
      <mark className="rounded bg-brand-100 px-0.5 text-brand-900">
        {label.slice(index, index + needle.length)}
      </mark>
      {label.slice(index + needle.length)}
    </>
  );
}

interface SearchablePickerProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  id?: string;
}

export function SearchablePicker({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  id,
}: SearchablePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.group ?? ''} ${option.label} ${option.keywords ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [options, query]);

  const grouped = useMemo(() => {
    const groups: Array<{ name: string; items: SearchableOption[] }> = [];
    for (const option of filtered) {
      const name = option.group ?? '';
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.items.push(option);
      else groups.push({ name, items: [option] });
    }
    return groups;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(option: SearchableOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  let optionIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-left text-sm font-medium text-ink-900 transition hover:border-ink-300 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`truncate ${selected ? '' : 'text-ink-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
          <div className="border-b border-ink-100 p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                className="!py-2 !pl-9"
              />
            </div>
          </div>
          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-500">{emptyLabel}</p>
            )}
            {query.trim() && filtered.length > 0 && (
              <p className="px-3 py-1.5 text-2xs font-medium text-ink-400">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </p>
            )}
            {grouped.map((group) => (
              <div key={group.name || '__ungrouped'}>
                {group.name && (
                  <p className="sticky top-0 z-10 bg-surface/95 px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-400 backdrop-blur">
                    {group.name}
                  </p>
                )}
                {group.items.map((option) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  const isSelected = option.value === value;
                  const isActive = index === active;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-800 hover:bg-ink-50'
                      }`}
                    >
                      <span className="truncate">{highlightMatch(option.label, query)}</span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
