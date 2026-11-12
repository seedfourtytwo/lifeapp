import type { NavigatorScreenParams } from '@react-navigation/native';

export type SettingsStackParamList = {
  AppSettingsHome: undefined;
  WeatherLocation: undefined;
  /** The Night road kit, every part in every state. Development builds only. */
  KitGallery: undefined;
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
  /** The ride of the open urge; closes itself when there is none. */
  Urge: undefined;
};
