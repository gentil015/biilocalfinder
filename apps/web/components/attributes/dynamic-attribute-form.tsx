'use client';

import { AttributeDef } from './attribute-fields';
import { AttributeField } from './attribute-field';

export function DynamicAttributeForm({
  attributes,
  values,
  onChange,
}: {
  attributes: AttributeDef[];
  values: Record<string, unknown>;
  onChange: (attributeId: string, value: unknown) => void;
}) {
  if (attributes.length === 0) return null;

  return (
    <div className="space-y-5">
      {attributes.map((attribute) => (
        <AttributeField
          key={attribute.id}
          attribute={attribute}
          value={values[attribute.id]}
          onChange={(v) => onChange(attribute.id, v)}
        />
      ))}
    </div>
  );
}
