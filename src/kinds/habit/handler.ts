import type { HabitConfig } from '../../protocol';
import { DEFAULT_HABIT_CONFIG } from '../../protocol';
import { sumEventValues } from '../../utils/events';
import type { KindHandler } from '../types';
import { HabitWidget } from './HabitWidget';

export const habitHandler: KindHandler<HabitConfig> = {
  kind: 'habit',
  defaultConfig: DEFAULT_HABIT_CONFIG,
  aggregateDaily: sumEventValues,
  DashboardWidget: HabitWidget,
};
