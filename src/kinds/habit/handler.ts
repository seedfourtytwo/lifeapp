import type { LifeEvent, HabitConfig } from '../../protocol';
import {
  DEFAULT_HABIT_CONFIG,
  isHabitDayComplete,
} from '../../protocol';
import type { KindHandler } from '../types';
import { HabitWidget } from './HabitWidget';

function sumValues(events: { value: number }[]): number {
  return events.reduce((sum, e) => sum + e.value, 0);
}

export function habitDayComplete(total: number, config: HabitConfig): boolean {
  return isHabitDayComplete(total, config);
}

export const habitHandler: KindHandler<HabitConfig> = {
  kind: 'habit',
  defaultConfig: DEFAULT_HABIT_CONFIG,
  aggregateDaily: sumValues,
  DashboardWidget: HabitWidget,
};

export function habitEventsComplete(events: LifeEvent[], config: HabitConfig): boolean {
  return habitDayComplete(sumValues(events), config);
}
