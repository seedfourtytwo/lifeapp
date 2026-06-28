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
} from './bundle';
export type { DashboardItem, ProtocolBundle } from './bundle';

export {
  CounterConfigSchema,
  CounterEventMetaSchema,
  DEFAULT_COUNTER_CONFIG,
} from './kinds/counter';
export type { CounterConfig, CounterEventMeta } from './kinds/counter';

export {
  HabitConfigSchema,
  HabitTimeSlotSchema,
  HabitTimeRangeSchema,
  DEFAULT_HABIT_CONFIG,
  HABIT_TIME_SLOT_LABELS,
  HABIT_TIME_SLOT_ORDER,
  buildHabitConfig,
  shouldShowHabitOnHabitsPage,
  formatHabitDescription,
} from './kinds/habit';
export type { HabitConfig, HabitTimeSlot, HabitTimeRange, HabitInput } from './kinds/habit';
