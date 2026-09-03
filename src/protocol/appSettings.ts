import { z } from 'zod';
import { parseTimeHHmm } from '../utils/time';

export const APP_LANGUAGES = ['system', 'en', 'fr'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isAppLanguage(value: string): value is AppLanguage {
  return (APP_LANGUAGES as readonly string[]).includes(value);
}

/**
 * What the person chose. `system` is a preference, not a look — it says "ask
 * the phone" and resolves to one of `RESOLVED_THEMES` at paint time.
 */
export const THEME_MODES = ['system', 'light', 'dark', 'cartoon'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** What can actually be painted. `getAppTheme` takes one of these, never a preference. */
export const RESOLVED_THEMES = ['light', 'dark', 'cartoon'] as const;

export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

/**
 * Turn the stored preference into something paintable.
 *
 * `scheme` is React Native's `useColorScheme()`, which is null before the OS
 * answers and on platforms that never do. Light is the safer default there: a
 * light app on a dark phone is a surprise, but a dark app on a light phone in
 * daylight is unreadable.
 */
export function resolveThemeMode(
  mode: ThemeMode,
  scheme: 'light' | 'dark' | null | undefined,
): ResolvedTheme {
  if (mode !== 'system') return mode;
  return scheme === 'dark' ? 'dark' : 'light';
}

export const WEATHER_LOCATION_MODES = ['device', 'manual'] as const;

export type WeatherLocationMode = (typeof WEATHER_LOCATION_MODES)[number];

export function isWeatherLocationMode(value: string): value is WeatherLocationMode {
  return (WEATHER_LOCATION_MODES as readonly string[]).includes(value);
}

/** Default local time for the evening unfinished-trackers digest. */
export const DEFAULT_EVENING_CHECK_IN_TIME = '20:00';

/**
 * On unless the user has stored a choice. Todos are the first feature that
 * depends on this reminder actually firing, and there is no settings UI to
 * turn it on with — so the default has to be the useful one.
 */
export const DEFAULT_EVENING_CHECK_IN_ENABLED = true;

const EveningCheckInTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Expected HH:mm');

const AppSettingsObjectSchema = z.object({
  themeMode: z.enum(THEME_MODES).optional(),
  appLanguage: z.enum(APP_LANGUAGES).optional(),
  /** Parked — no Settings UI or scheduler. Kept for backup import. */
  eveningCheckInEnabled: z.boolean().optional(),
  /** Parked — no Settings UI or scheduler. Kept for backup import. */
  eveningCheckInTime: EveningCheckInTimeSchema.optional(),
  /** @deprecated Prefer eveningCheckInEnabled — kept for backup import. */
  habitRemindersEnabled: z.boolean().optional(),
  weatherWidgetEnabled: z.boolean().optional(),
  weatherLocationMode: z.enum(WEATHER_LOCATION_MODES).optional(),
  weatherPlaceName: z.string().min(1).optional(),
  weatherLat: z.number().min(-90).max(90).optional(),
  weatherLon: z.number().min(-180).max(180).optional(),
  /**
   * Which journal notebook the Nutrition tab writes food notes into. A link,
   * not a preference — it travels in backup so a restore does not offer to
   * create a second food journal. An id nothing answers to is simply ignored.
   */
  foodJournalNotebookId: z.string().uuid().optional(),
});

/** Normalize legacy habitRemindersEnabled into eveningCheckInEnabled. */
export const AppSettingsSchema = AppSettingsObjectSchema.transform((settings) => {
  const { habitRemindersEnabled, eveningCheckInEnabled, ...rest } = settings;
  const enabled = eveningCheckInEnabled ?? habitRemindersEnabled;
  return {
    ...rest,
    ...(enabled !== undefined ? { eveningCheckInEnabled: enabled } : {}),
  };
});

export type AppSettings = z.output<typeof AppSettingsSchema>;

export const APP_SETTING_KEYS = {
  themeMode: 'theme_mode',
  appLanguage: 'app_language',
  eveningCheckInEnabled: 'evening_check_in_enabled',
  eveningCheckInTime: 'evening_check_in_time',
  /** Legacy key — read for migration only. */
  habitRemindersEnabled: 'habit_reminders_enabled',
  weatherWidgetEnabled: 'weather_widget_enabled',
  weatherLocationMode: 'weather_location_mode',
  weatherPlaceName: 'weather_place_name',
  weatherLat: 'weather_lat',
  weatherLon: 'weather_lon',
  foodJournalNotebookId: 'food_journal_notebook_id',
} as const;

/** Accepts flexible input (8:00, 800, 08:00) and returns strict HH:mm. */
export function parseEveningCheckInTime(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  return parseTimeHHmm(value);
}
