export type RootStackParamList = {
  Home: undefined;
  SettingsMenu: undefined;
  Trackers: undefined;
  AppSettings: undefined;
  TrackerHistory: { elementId: string };
  Insights: undefined;
  Journal: undefined;
  Calendar: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
