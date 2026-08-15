import type { NavigatorScreenParams } from '@react-navigation/native';

export type SettingsStackParamList = {
  AppSettingsHome: undefined;
  WeatherLocation: undefined;
};

export type RootStackParamList = {
  Home: undefined;
  SettingsMenu: undefined;
  Trackers: undefined;
  AppSettings: NavigatorScreenParams<SettingsStackParamList> | undefined;
  TrackerHistory: { elementId: string };
  Insights: undefined;
  Journal: undefined;
  Calendar: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
