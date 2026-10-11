'use client';

import { Check } from 'lucide-react';

export interface AttributeDef {
  id: string;
  name: string;
  description?: string | null;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'PRICE';
  isRequired: boolean;
  options?: string[] | null;
}

// Bare inputs, selects and textareas already carry the product's control
// styling from globals.css, so this only holds the extras every attribute
// control shares — there is no reason for each type to re-declare the base look.
const fieldClass = 'w-full';

export function TextAttribute({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className={fieldClass}
      value={value ?? ''}
      required={attribute.isRequired}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberAttribute({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`${fieldClass} tabular`}
      value={value ?? ''}
      required={attribute.isRequired}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  );
}

export function PriceAttribute({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 px-3 text-2xs font-bold uppercase tracking-wide text-ink-500">
        RWF
      </span>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        className={`${fieldClass} tabular rounded-l-none pl-16`}
        value={value ?? ''}
        required={attribute.isRequired}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    </div>
  );
}

export function BooleanAttribute({
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  // Large touch targets, two clear options — friendlier on mobile than a
  // bare checkbox (spec §27-28).
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'Yes', v: true },
        { label: 'No', v: false },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          aria-pressed={value === opt.v}
          onClick={() => onChange(opt.v)}
          className={`btn ${value === opt.v ? 'btn-primary' : 'btn-secondary'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SelectAttribute({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className={fieldClass} value={value ?? ''} required={attribute.isRequired} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select…</option>
      {(attribute.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export function MultiSelectAttribute({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = value ?? [];

  function toggle(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
  }

  // Checkbox chip grid — works well on mobile without a separate dialog,
  // and avoids a native multi-select's poor touch UX (spec §28).
  return (
    <div className="flex flex-wrap gap-2">
      {(attribute.options ?? []).map((opt) => {
        const isOn = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(opt)}
            className={`chip ${isOn ? 'chip-active' : 'chip-interactive'}`}
          >
            {isOn && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
