import type { NavigatorScreenParams } from '@react-navigation/native';

export type SettingsStackParamList = {
  AppSettingsHome: undefined;
  WeatherLocation: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  Trackers: undefined;
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
