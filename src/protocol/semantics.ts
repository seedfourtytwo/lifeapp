import type { ElementDefinition } from './element';
import { dayOutcome, type DayFacts } from './dayOutcome';

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

function unknownKind(element: never): never {
  throw new Error(`Unknown tracker kind: ${JSON.stringify(element)}`);
}

export function getDailyValueSemantics(element: ElementDefinition): DailyValueSemantics {
  switch (element.kind) {
    case 'counter':
      return { unit: 'count', displayUnit: element.config.unit };
    case 'habit':
      return element.config.trackingMode === 'timer'
        ? { unit: 'seconds', displayUnit: 'seconds' }
        : { unit: 'done', displayUnit: 'done' };
    default:
      return unknownKind(element);
  }
}

/** History/Insights chart y-axis unit label — 'min' and 'done' are literal labels, not i18n keys. */
export function chartUnitLabel(element: ElementDefinition): string {
  switch (element.kind) {
    case 'counter':
      return element.config.unit;
    case 'habit':
      return element.config.trackingMode === 'timer' ? 'min' : 'done';
    default:
      return unknownKind(element);
  }
}

/** A day -> chart plot value (seconds -> minutes for a timer habit, done -> 1 for a check-off). */
export function chartPlotValue(element: ElementDefinition, facts: DayFacts): number {
  switch (element.kind) {
    case 'counter':
      return facts.total;
    case 'habit':
      if (element.config.trackingMode === 'timer') return Math.round(facts.total / 60);
      return dayOutcome(element, facts).done ? 1 : 0;
    default:
      return unknownKind(element);
  }
}
