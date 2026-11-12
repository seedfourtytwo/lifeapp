import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

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
export function pickWithPhone({ mode, value, minimumDate, maximumDate }: PickRequest): Promise<Date | null> {
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
