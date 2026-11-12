import React, { useEffect, useState } from 'react';
import { parseTimeHHmm } from '../utils/time';
import { Field } from './Field';
import { hasPhonePicker, pickTime } from './phonePicker';
import { formatPickedTime } from './pickerFormat';

type Props = {
  label: string;
  /** `HH:mm`, or null when none is set yet. */
  value: string | null;
  onChange: (value: string) => void;
  /** Shown when no time is set. */
  placeholder?: string;
  disabled?: boolean;
};

/**
 * A time of day. On the phone it opens Android's own clock and never shows a
 * text box; off the phone (web, tests) it falls back to typing `HH:mm`.
 */
export function TimeField({ label, value, onChange, placeholder, disabled }: Props) {
  const [typed, setTyped] = useState(value ?? '');
  useEffect(() => setTyped(value ?? ''), [value]);

  if (!hasPhonePicker()) {
    const commit = () => {
      const parsed = parseTimeHHmm(typed);
      if (parsed) onChange(parsed);
      else setTyped(value ?? '');
    };
    return (
      <Field
        label={label}
        value={typed}
        onChangeText={setTyped}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={placeholder ?? 'HH:mm'}
        maxLength={5}
        disabled={disabled}
      />
    );
  }

  return (
    <Field
      label={label}
      value={value ? formatPickedTime(value) : ''}
      placeholder={placeholder}
      disabled={disabled}
      onPress={() =>
        void pickTime(value).then((picked) => {
          if (picked) onChange(picked);
        })
      }
    />
  );
}
