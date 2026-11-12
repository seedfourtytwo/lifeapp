import type React from 'react';
import type { SettingsStackParamList } from './types';

export type DevSettingsScreen = {
  name: keyof SettingsStackParamList;
  getComponent: () => React.ComponentType;
};

/**
 * Settings screens that exist only in a development build. Release builds
 * compile `__DEV__` to false, so this is an empty table there and the
 * gallery's module is never required, nor bundled.
 */
export const DEV_SETTINGS_SCREENS: readonly DevSettingsScreen[] = __DEV__
  ? [
      {
        name: 'KitGallery',
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports -- a lazy require keeps it out of the release bundle
        getComponent: () => (require('../screens/dev/KitGallery') as typeof import('../screens/dev/KitGallery')).default,
      },
    ]
  : [];
