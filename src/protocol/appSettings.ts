import { z } from 'zod';
import { DAILY_ARRANGE_MODES, DAILY_VIEW_FILTERS } from './dailyView';

export const THEME_MODES = ['light', 'dark', 'cartoon'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

export const WEATHER_LOCATION_MODES = ['device', 'manual'] as const;

export type WeatherLocationMode = (typeof WEATHER_LOCATION_MODES)[number];

export function isWeatherLocationMode(value: string): value is WeatherLocationMode {
  return (WEATHER_LOCATION_MODES as readonly string[]).includes(value);
}

export const AppSettingsSchema = z.object({
  themeMode: z.enum(THEME_MODES).optional(),
  /** @deprecated Daily no longer uses view filters; accepted for older backups. */
  dailyViewFilter: z.enum(DAILY_VIEW_FILTERS).optional(),
  /** @deprecated Daily no longer uses arrange modes; accepted for older backups. */
  dailyArrangeMode: z.enum(DAILY_ARRANGE_MODES).optional(),
  habitRemindersEnabled: z.boolean().optional(),
  weatherWidgetEnabled: z.boolean().optional(),
  calendarWidgetEnabled: z.boolean().optional(),
  weatherLocationMode: z.enum(WEATHER_LOCATION_MODES).optional(),
  weatherPlaceName: z.string().min(1).optional(),
  weatherLat: z.number().min(-90).max(90).optional(),
  weatherLon: z.number().min(-180).max(180).optional(),
  weatherBubbleX: z.number().min(0).max(1).optional(),
  weatherBubbleY: z.number().min(0).max(1).optional(),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const APP_SETTING_KEYS = {
  themeMode: 'theme_mode',
  dailyViewFilter: 'daily_view_filter',
  dailyArrangeMode: 'daily_arrange_mode',
  habitRemindersEnabled: 'habit_reminders_enabled',
  weatherWidgetEnabled: 'weather_widget_enabled',
  calendarWidgetEnabled: 'calendar_widget_enabled',
  weatherLocationMode: 'weather_location_mode',
  weatherPlaceName: 'weather_place_name',
  weatherLat: 'weather_lat',
  weatherLon: 'weather_lon',
  weatherBubbleX: 'weather_bubble_x',
  weatherBubbleY: 'weather_bubble_y',
} as const;
