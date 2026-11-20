export type RootStackParamList = {
  Home: undefined;
  Calendar: undefined;
  Review: undefined;
  /** `add` opens the new-tracker editor straight away; closing it returns. */
  /** `add` opens the editor on a new tracker; `true` leaves the kind to the sheet. */
  Trackers: { add?: 'habit' | 'counter' | true } | undefined;
  Nutrition: undefined;
  Ingredients: undefined;
  IngredientEditor: { foodId?: string };
  WeatherLocation: undefined;
  TrackerHistory: { elementId: string };
  TodoHistory: undefined;
  CalendarEventEditor: { eventId?: string; seedDate?: string };
};
