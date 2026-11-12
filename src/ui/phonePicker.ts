import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dateAsDay, dateAsTime, dayAsDate, timeAsDate } from './pickerFormat';

/** Whether the phone's own date and time dialogs are there to open. Elsewhere (web, tests) the fields fall back to typing. */
export function hasPhonePicker(): boolean {
  return Platform.OS === 'android';
}

type PickRequest = {
  mode: 'date' | 'time';
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
};

/**
 * Opens Android's own picker dialog and settles with what was set, or null
 * when it was dismissed or could not open. Never rejects: a picker that did
 * not open leaves the value as it was.
 */
function pickWithPhone({ mode, value, minimumDate, maximumDate }: PickRequest): Promise<Date | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      mode,
      value,
      is24Hour: true,
      minimumDate,
      maximumDate,
      onChange: (event, picked) => resolve(event.type === 'set' && picked ? picked : null),
      onError: () => resolve(null),
    });
  });
}

/**
 * Asks the phone's clock for a time, opening on `value`: the stored `HH:mm`
 * picked, or null when dismissed. For a time shown as a chip rather than a
 * field (a habit's reminders); `TimeField` goes through it too.
 */
export async function pickTime(value: string | null): Promise<string | null> {
  const picked = await pickWithPhone({ mode: 'time', value: timeAsDate(value, new Date()) });
  return picked ? dateAsTime(picked) : null;
}

/** Asks the phone's calendar for a day, inside the bounds: the stored `YYYY-MM-DD` picked, or null. */
export async function pickDate(
  value: string | null,
  today: string,
  bounds: { minimumDate?: string; maximumDate?: string } = {},
): Promise<string | null> {
  const picked = await pickWithPhone({
    mode: 'date',
    value: dayAsDate(value, today),
    minimumDate: bounds.minimumDate ? dayAsDate(bounds.minimumDate, today) : undefined,
    maximumDate: bounds.maximumDate ? dayAsDate(bounds.maximumDate, today) : undefined,
  });
  return picked ? dateAsDay(picked) : null;
}
