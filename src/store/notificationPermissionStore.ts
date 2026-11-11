import { Linking } from 'react-native';
import { create } from 'zustand';
import {
  getNotificationPermission,
  requestNotificationPermissions,
  type NotificationPermission,
} from '../notifications/notificationsBootstrap';

interface NotificationPermissionState {
  /** Null until first read. The OS owns this; it is not stored in SQLite. */
  permission: NotificationPermission | null;
  refresh: () => Promise<void>;
  /** Show the prompt, or system settings once the phone no longer will. */
  request: () => Promise<void>;
}

export const useNotificationPermissionStore = create<NotificationPermissionState>((set, get) => ({
  permission: null,

  refresh: async () => {
    set({ permission: await getNotificationPermission() });
  },

  request: async () => {
    const current = get().permission ?? (await getNotificationPermission());
    if (current.canAskAgain) {
      await requestNotificationPermissions();
    } else {
      await Linking.openSettings();
    }
    await get().refresh();
  },
}));
