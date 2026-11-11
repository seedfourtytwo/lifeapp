import {
  CounterConfigSchema,
  dayOutcome,
  formatHabitTimerDuration,
  parseHabitConfig,
  type DayFacts,
  type ElementDefinition,
} from '../protocol';

export function formatTrackerHistoryDayValue(
  element: ElementDefinition | null,
  facts: DayFacts,
): string {
  const { total } = facts;
  if (!element) return String(total);

  if (element.kind === 'habit') {
    const config = parseHabitConfig(element.config);
    if (config.trackingMode === 'timer') {
      return total > 0 ? formatHabitTimerDuration(total) : '—';
    }
    return dayOutcome({ kind: 'habit', config }, facts).done ? 'Done' : '—';
  }

  const unit = CounterConfigSchema.parse(element.config).unit;
  return `${total} ${unit}`;
}

export function truncateNotePreview(body: string, max = 48): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
