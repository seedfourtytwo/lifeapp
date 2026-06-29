export { PROTOCOL_VERSION, wrapPayload } from './envelope';
export type { ProtocolEnvelope, ProtocolVersion } from './envelope';

export {
  ElementKindSchema,
  ElementCategorySchema,
  ElementDefinitionSchema,
  validateElementConfig,
  parseElementDefinition,
} from './element';
export type { ElementKind, ElementCategory, ElementDefinition } from './element';

export { EventSchema, parseEvent, toDateString } from './event';
export type { LifeEvent } from './event';

export {
  DashboardItemSchema,
  ProtocolBundleSchema,
  parseProtocolBundle,
  createProtocolBundle,
} from './bundle';
export type { DashboardItem, ProtocolBundle } from './bundle';

export { SoundAssetSchema, SoundLibrarySchema, parseSoundLibrary } from './sound';
export type { SoundAsset } from './sound';

export {
  parseEventMeta,
  validateEventForElement,
  validateBundleEventLinks,
} from './eventMeta';

export { getDailyValueSemantics, isElementDayComplete } from './semantics';
export type { DailyValueSemantics, DailyValueUnit } from './semantics';

export {
  CounterConfigSchema,
  CounterEventMetaSchema,
  DEFAULT_COUNTER_CONFIG,
  buildCounterConfig,
  formatCounterUnit,
} from './kinds/counter';
export type { CounterConfig, CounterEventMeta, CounterInput } from './kinds/counter';

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
  isHabitDayComplete,
  shouldShowHabitOnHabitsPage,
  formatHabitDescription,
  formatHabitTimerDuration,
  timerSessionDurationSeconds,
  buildTimerSessionPayload,
  liveTimerTotalSeconds,
  isHabitScheduledOnDate,
} from './kinds/habit';
export type {
  HabitConfig,
  HabitEventMeta,
  HabitSchedule,
  HabitTimeSlot,
  HabitTimeRange,
  HabitTrackingMode,
  HabitInput,
} from './kinds/habit';
