export type RootStackParamList = {
  Home: undefined;
  SettingsMenu: undefined;
  Elements: undefined;
  AppSettings: undefined;
  ElementHistory: { elementId: string };
  Calendar: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
