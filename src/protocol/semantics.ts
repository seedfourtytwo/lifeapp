import type { ElementDefinition } from './element';
import { CounterConfigSchema } from './kinds/counter';
import { HabitConfigSchema, isHabitDayComplete } from './kinds/habit';

/**
 * Life Protocol v1 — how to read `event.value` for daily aggregation (SUM per element per date).
 *
 * | kind    | config              | event.value meaning      | meta.source (typical)   |
 * |---------|---------------------|--------------------------|-------------------------|
 * | counter | —                   | increment or set total   | quick_button, manual    |
 * | habit   | trackingMode boolean| 1 = checked off          | habit_tick              |
 * | habit   | trackingMode timer  | session length (seconds) | timer_session           |
 *
 * Daily total = SUM(events.value) for that element on that calendar date.
 * Completion rules live in kind config (e.g. dailyTarget, dailyTargetSeconds).
 */

export type DailyValueUnit = 'count' | 'seconds' | 'done';

export interface DailyValueSemantics {
  unit: DailyValueUnit;
  displayUnit: string;
}

export function getDailyValueSemantics(element: ElementDefinition): DailyValueSemantics {
  if (element.kind === 'counter') {
    const config = CounterConfigSchema.parse(element.config);
    return { unit: 'count', displayUnit: config.unit };
  }

  const config = HabitConfigSchema.parse(element.config);
  if (config.trackingMode === 'timer') {
    return { unit: 'seconds', displayUnit: 'seconds' };
  }
  return { unit: 'done', displayUnit: 'done' };
}

export function isElementDayComplete(element: ElementDefinition, dailyTotal: number): boolean {
  if (element.kind === 'counter') {
    const config = CounterConfigSchema.parse(element.config);
    if (config.dailyTarget && config.dailyTarget > 0) {
      return dailyTotal >= config.dailyTarget;
    }
    return dailyTotal > 0;
  }

  const config = HabitConfigSchema.parse(element.config);
  return isHabitDayComplete(dailyTotal, config);
}

/** History/Insights chart y-axis unit label — 'min' and 'done' are literal labels, not i18n keys. */
export function chartUnitLabel(element: ElementDefinition): string {
  if (element.kind === 'counter') {
    return CounterConfigSchema.parse(element.config).unit;
  }
  const config = HabitConfigSchema.parse(element.config);
  return config.trackingMode === 'timer' ? 'min' : 'done';
}

/** Raw daily total -> chart plot value (e.g. seconds -> minutes for a timer habit). */
export function chartPlotValue(element: ElementDefinition, dailyTotal: number): number {
  if (element.kind === 'counter') {
    return dailyTotal;
  }
  const config = HabitConfigSchema.parse(element.config);
  if (config.trackingMode === 'timer') {
    return Math.round(dailyTotal / 60);
  }
  return isHabitDayComplete(dailyTotal, config) ? 1 : 0;
}
