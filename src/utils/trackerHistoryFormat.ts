import { i18n } from '../i18n';
import {
  dayOutcome,
  formatHabitTimerDuration,
  type DayFacts,
  type ElementDefinition,
} from '../protocol';

export function formatTrackerHistoryDayValue(
  element: ElementDefinition | null,
  facts: DayFacts,
): string {
  const { total } = facts;
  if (!element) return String(total);

  switch (element.kind) {
    case 'habit':
      if (element.config.trackingMode === 'timer') {
        return total > 0 ? formatHabitTimerDuration(total) : '—';
      }
      return dayOutcome(element, facts).done ? 'Done' : '—';
    case 'counter':
      return `${total} ${element.config.unit}`;
    case 'commitment':
      return i18n.t(
        dayOutcome(element, facts).done ? 'trackers:commitment.dayClear' : 'trackers:commitment.daySlip',
      );
    default: {
      const unknown: never = element;
      throw new Error(`Unknown tracker kind: ${JSON.stringify(unknown)}`);
    }
  }
}

export function truncateNotePreview(body: string, max = 48): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
