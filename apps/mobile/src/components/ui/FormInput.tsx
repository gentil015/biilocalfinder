import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Input } from './Input';

type KeyboardType = 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad';

interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardType;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  hint?: string;
  editable?: boolean;
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  error,
  ...props
}: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          label={label}
          value={String(field.value ?? '')}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={error}
          {...props}
        />
      )}
    />
  );
}
