import type { NavigatorScreenParams } from '@react-navigation/native';

export type SettingsStackParamList = {
  AppSettingsHome: undefined;
  WeatherLocation: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  /** `add` opens the new-tracker editor straight away; closing it returns. */
  Trackers: { add?: 'habit' | 'counter' } | undefined;
  Ingredients: undefined;
  IngredientEditor: { foodId?: string };
  AppSettings: NavigatorScreenParams<SettingsStackParamList> | undefined;
  TrackerHistory: { elementId: string };
  Insights: undefined;
  Journal: undefined;
  TodoHistory: undefined;
  Calendar: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
