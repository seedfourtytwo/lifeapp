import type { HabitConfig, LifeEvent } from '../protocol';
import { isHabitDayComplete } from '../protocol';

type DayEvent = Pick<LifeEvent, 'value' | 'meta'>;

export function shouldPlayHabitCompletionChime(
  config: HabitConfig,
  previousTotal: number,
  newTotal: number,
  previousEvents: readonly DayEvent[],
  newEvents: readonly DayEvent[],
  options?: { trackCompleted?: boolean },
): boolean {
  if (config.trackingMode !== 'timer') return false;
  if (options?.trackCompleted) return true;

  const target = config.dailyTargetSeconds;
  if (!target || target <= 0) return false;

  const wasComplete = isHabitDayComplete(previousTotal, config, previousEvents);
  const isComplete = isHabitDayComplete(newTotal, config, newEvents);
  return !wasComplete && isComplete;
}
