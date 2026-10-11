'use client';

import { useI18n } from '@/components/locale-provider';
import {
  AttributeDef,
  BooleanAttribute,
  MultiSelectAttribute,
  NumberAttribute,
  PriceAttribute,
  SelectAttribute,
  TextAttribute,
} from './attribute-fields';

export function AttributeField({
  attribute,
  value,
  onChange,
}: {
  attribute: AttributeDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { t } = useI18n();
  // BOOLEAN and MULTI_SELECT render several controls under one name, so they
  // get a fieldset to group them. Every other type renders exactly one control,
  // so a wrapping label is the stronger association — and it puts the help text
  // in the control's accessible name instead of leaving it unannounced.
  const isGrouped = attribute.type === 'BOOLEAN' || attribute.type === 'MULTI_SELECT';

  const control = (
    <>
      {attribute.type === 'TEXT' && (
        <TextAttribute attribute={attribute} value={value as string} onChange={onChange} />
      )}
      {attribute.type === 'NUMBER' && (
        <NumberAttribute attribute={attribute} value={value as number | ''} onChange={onChange} />
      )}
      {attribute.type === 'PRICE' && (
        <PriceAttribute attribute={attribute} value={value as number | ''} onChange={onChange} />
      )}
      {attribute.type === 'BOOLEAN' && (
        <BooleanAttribute attribute={attribute} value={value as boolean} onChange={onChange} />
      )}
      {attribute.type === 'SELECT' && (
        <SelectAttribute attribute={attribute} value={value as string} onChange={onChange} />
      )}
      {attribute.type === 'MULTI_SELECT' && (
        <MultiSelectAttribute attribute={attribute} value={value as string[]} onChange={onChange} />
      )}
    </>
  );

  const name = (
    <>
      {attribute.name}
      {attribute.isRequired && (
        <>
          <span className="text-danger-600" aria-hidden="true">
            {' '}
            *
          </span>
          <span className="sr-only">{t('attribute.required')}</span>
        </>
      )}
    </>
  );

  if (isGrouped) {
    return (
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="label">{name}</legend>
        {attribute.description && <p className="hint mb-2.5 mt-0">{attribute.description}</p>}
        {control}
      </fieldset>
    );
  }

  return (
    <label className="block">
      <span className="label">{name}</span>
      {attribute.description && <span className="hint mb-2.5 mt-0 block">{attribute.description}</span>}
      {control}
    </label>
  );
}
