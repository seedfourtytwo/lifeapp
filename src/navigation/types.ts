export type RootStackParamList = {
  Home: undefined;
  SettingsMenu: undefined;
  Trackers: undefined;
  AppSettings: undefined;
  TrackerHistory: { elementId: string };
  Calendar: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
