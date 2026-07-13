import type { LifeEvent, HabitConfig } from '../../protocol';
import {
  DEFAULT_HABIT_CONFIG,
  isHabitDayComplete,
} from '../../protocol';
import { sumEventValues } from '../../utils/events';
import type { KindHandler } from '../types';
import { HabitWidget } from './HabitWidget';

export const habitHandler: KindHandler<HabitConfig> = {
  kind: 'habit',
  defaultConfig: DEFAULT_HABIT_CONFIG,
  aggregateDaily: sumEventValues,
  DashboardWidget: HabitWidget,
};

export function habitEventsComplete(events: LifeEvent[], config: HabitConfig): boolean {
  return isHabitDayComplete(sumEventValues(events), config, events);
}
