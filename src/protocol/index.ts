export { PROTOCOL_VERSION } from './envelope';
export type { ProtocolVersion } from './envelope';

export {
  ElementKindSchema,
  ElementDefinitionSchema,
  assertElementConfig,
  isCommitmentElement,
  isCounterElement,
  isHabitElement,
  parseElementDefinition,
} from './element';
export type {
  CommitmentElement,
  CounterElement,
  ElementDefinition,
  ElementKind,
  HabitElement,
} from './element';

export { EventSchema, toDateString, parseLocalDate, shiftDateString } from './event';
export type { LifeEvent } from './event';

export { DayNoteSchema, DAY_NOTE_BODY_MAX_LENGTH, validateBundleDayNoteLinks } from './dayNote';
export type { DayNote } from './dayNote';

export {
  DailyJournalSchema,
  DAILY_JOURNAL_BODY_MAX_LENGTH,
  joinJournalDayBodies,
  validateBundleDailyJournals,
} from './dailyJournal';
export type { DailyJournal } from './dailyJournal';

export {
  JournalNotebookSchema,
  JournalNotebookColorSchema,
  JOURNAL_NOTEBOOK_MAX,
  JOURNAL_NOTEBOOK_NAME_MAX,
  JOURNAL_NOTEBOOK_COLORS,
  DEFAULT_JOURNAL_NOTEBOOK_COLOR,
  DEFAULT_JOURNAL_NOTEBOOK_NAME,
  isJournalNotebookColor,
  nextJournalNotebookColor,
  validateBundleJournalNotebooks,
} from './journalNotebook';
export type { JournalNotebook, JournalNotebookColor } from './journalNotebook';

export {
  FoodItemSchema,
  FoodLogEntrySchema,
  FoodGroupSchema,
  FoodNutrientsSchema,
  FoodNutrientBasisSchema,
  FoodPortionSchema,
  FoodStateSchema,
  FOOD_GROUPS,
  FOOD_NUTRIENT_BASES,
  FOOD_STATES,
  FOOD_NAME_MAX_LENGTH,
  FOOD_ALIAS_MAX,
  FOOD_PORTION_MAX,
  PLANT_FOOD_GROUPS,
  WEEKLY_PLANT_TARGET,
  foodDiversityKey,
  glycemicLoadPer100,
  isFoodInPeakSeason,
  isFoodInSeason,
  isPlantFood,
  isPlantFoodGroup,
  validateBundleFoodLinks,
} from './food';
export type {
  FoodItem,
  FoodLogEntry,
  FoodGroup,
  FoodNutrients,
  FoodNutrientsInput,
  FoodNutrientBasis,
  FoodPortion,
  FoodState,
} from './food';

export {
  TODO_SECTIONS,
  TODO_TITLE_MAX_LENGTH,
  TODO_NOTE_MAX_LENGTH,
  TodoSchema,
  compareTodos,
  countTodosNeedingAttention,
  groupOpenTodos,
  isTodoOpen,
  nextTodoSortOrder,
  todoSection,
  validateBundleTodos,
} from './todo';
export type { Todo, TodoInput, TodoGroup, TodoSection } from './todo';

export {
  AppSettingsSchema,
  APP_SETTING_KEYS,
  DEFAULT_EVENING_CHECK_IN_TIME,
  DEFAULT_EVENING_CHECK_IN_ENABLED,
  THEME_MODES,
  WEATHER_LOCATION_MODES,
  isThemeMode,
  parseThemeMode,
  isWeatherLocationMode,
  parseEveningCheckInTime,
} from './appSettings';
export type { AppSettings, ThemeMode, WeatherLocationMode } from './appSettings';

export {
  DashboardItemSchema,
  parseProtocolBundle,
  createProtocolBundle,
} from './bundle';
export type { DashboardItem, ProtocolBundle } from './bundle';

export {
  HabitTimerPlaybackModeSchema,
  HabitTimerSoundSchema,
  type HabitTimerPlaybackMode,
  type HabitTimerSound,
} from './habitSound';
export {
  buildHabitTimerSound,
  formatHabitTimerSoundSummary,
  getHabitTimerPlaybackMode,
  habitTimerTrack,
  hasHabitTimerSound,
} from './habitSound';
export {
  BUNDLED_HABIT_SOUND_CATALOG,
  getBundledHabitSoundDurationSeconds,
  getBundledHabitSoundLabel,
  isBundledHabitSoundId,
  type BundledHabitSound,
} from './habitSoundCatalog';

export { dayFactsFromEvents, dayOutcome, factsFromTotal, habitTimerGoal } from './dayOutcome';
export type {
  DayEvent,
  DayFacts,
  DayOutcome,
  DayOutcomeReason,
  DayOutcomeTracker,
  HabitTimerGoal,
} from './dayOutcome';

export {
  parseEventMeta,
  validateEventForElement,
  validateBundleEventLinks,
} from './eventMeta';

export {
  chartPlotValue,
  chartUnitLabel,
  getDailyValueSemantics,
} from './semantics';
export type { DailyValueSemantics, DailyValueUnit } from './semantics';

export {
  CounterConfigSchema,
  CounterEventMetaSchema,
  DEFAULT_COUNTER_CONFIG,
  buildCounterConfig,
  formatCounterUnit,
  shouldShowCounterStreakOnCard,
} from './kinds/counter';
export type { CounterConfig, CounterEventMeta, CounterInput } from './kinds/counter';

export {
  CommitmentConfigSchema,
  CommitmentEventMetaSchema,
  DEFAULT_COMMITMENT_LOCK_SCREEN_NAME,
  INSTEAD_HABITS_MAX,
  OWN_LINES_MAX,
  OWN_LINE_MAX_LENGTH,
  buildCommitmentConfig,
  currentOwnLine,
  insteadHabitIdsProblem,
  lampHours,
  lampsPassed,
  nextLamp,
  usableInsteadHabits,
  RIDE_MINUTE_CHOICES,
} from './kinds/commitment';
export type { CommitmentConfig, CommitmentInput, NextLamp } from './kinds/commitment';

export {
  TRACKER_ICON_IDS,
  TRACKER_ICON_FEATURED_IDS,
  TRACKER_ICON_MORE_IDS,
  CUSTOM_TRACKER_ICON_IDS,
  TrackerIconIdSchema,
  OptionalTrackerIconSchema,
  isTrackerIconId,
  isFeaturedTrackerIconId,
  isCustomTrackerIconId,
  iconIdMatchesQuery,
} from './trackerIcons';
export type { TrackerIconId, CustomTrackerIconId } from './trackerIcons';

export {
  HabitConfigSchema,
  HabitEventMetaSchema,
  HabitScheduleSchema,
  HabitTimeSlotSchema,
  HabitTimeRangeSchema,
  HabitTrackingModeSchema,
  DEFAULT_HABIT_CONFIG,
  HABIT_TIME_SLOT_LABELS,
  HABIT_TIME_SLOT_ORDER,
  buildHabitConfig,
  LOCK_SCREEN_NAME_MAX,
  normalizeLockScreenName,
  normalizeReminderTimes,
  shouldShowHabitOnHabitsPage,
  shouldShowHabitStreakOnCard,
  formatHabitDescription,
  formatHabitTimerDuration,
  formatHabitHomeTimerLabel,
  timerSessionDurationSeconds,
  buildTimerSessionPayload,
  buildTimerSessionPayloadFromDuration,
  liveTimerTotalSeconds,
  isHabitScheduledOnDate,
  isHabitStartingSoon,
  formatScheduleDescription,
} from './kinds/habit';
export type { ActiveTimerSession } from './activeTimerSession';
export {
  ActiveTimerSessionSchema,
  activeTimerElapsedMs,
  activeTimerElapsedSeconds,
  createActiveTimerSession,
  isActiveTimerPaused,
} from './activeTimerSession';
export { isScheduleActiveOnDate, isScheduleSupportedForReminders } from './schedule';
export {
  filterHabitsDueToday,
  orderHabitsList,
  isHabitDueToday,
} from './habitsList';
export type { HabitListFilterContext } from './habitsList';
export type {
  HabitConfig,
  HabitEventMeta,
  HabitSchedule,
  HabitTimeSlot,
  HabitTimeRange,
  HabitTrackingMode,
  HabitInput,
} from './kinds/habit';
