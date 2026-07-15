import { z } from 'zod';
import { DAILY_VIEW_FILTERS } from './dailyView';

export const THEME_MODES = ['light', 'dark', 'cartoon'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

export const AppSettingsSchema = z.object({
  themeMode: z.enum(THEME_MODES).optional(),
  dailyViewFilter: z.enum(DAILY_VIEW_FILTERS).optional(),
  habitRemindersEnabled: z.boolean().optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const APP_SETTING_KEYS = {
  themeMode: 'theme_mode',
  dailyViewFilter: 'daily_view_filter',
  habitRemindersEnabled: 'habit_reminders_enabled',
} as const;
