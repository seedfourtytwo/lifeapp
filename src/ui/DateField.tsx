import React, { useEffect, useState } from 'react';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { Field } from './Field';
import { hasPhonePicker, pickWithPhone } from './phonePicker';
import { dateAsDay, dayAsDate, formatPickedDate, parseTypedDate } from './pickerFormat';

type Props = {
  label: string;
  /** `YYYY-MM-DD`, or null when none is set yet. */
  value: string | null;
  onChange: (value: string) => void;
  /** Earliest and latest day that can be picked, `YYYY-MM-DD`. */
  minimumDate?: string;
  maximumDate?: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * A calendar day. On the phone it opens Android's own calendar and never
 * shows a text box; off the phone (web, tests) it falls back to typing
 * `YYYY-MM-DD`.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder, disabled }: Props) {
  const [typed, setTyped] = useState(value ?? '');
  useEffect(() => setTyped(value ?? ''), [value]);
  const today = currentAppCalendarDate();

  if (!hasPhonePicker()) {
    const commit = () => {
      const parsed = parseTypedDate(typed);
      const inside = parsed && (!minimumDate || parsed >= minimumDate) && (!maximumDate || parsed <= maximumDate);
      if (parsed && inside) onChange(parsed);
      else setTyped(value ?? '');
    };
    return (
      <Field
        label={label}
        value={typed}
        onChangeText={setTyped}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={placeholder ?? 'YYYY-MM-DD'}
        maxLength={10}
        disabled={disabled}
      />
    );
  }

  return (
    <Field
      label={label}
      value={value ? formatPickedDate(value, today) : ''}
      placeholder={placeholder}
      disabled={disabled}
      onPress={() =>
        void pickWithPhone({
          mode: 'date',
          value: dayAsDate(value, today),
          minimumDate: minimumDate ? dayAsDate(minimumDate, today) : undefined,
          maximumDate: maximumDate ? dayAsDate(maximumDate, today) : undefined,
        }).then((picked) => {
          if (picked) onChange(dateAsDay(picked));
        })
      }
    />
  );
}
