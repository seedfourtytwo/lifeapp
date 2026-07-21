import {
  CounterConfigSchema,
  formatHabitTimerDuration,
  isHabitDayComplete,
  parseHabitConfig,
  type ElementDefinition,
} from '../protocol';

export function formatTrackerHistoryDayValue(
  element: ElementDefinition | null,
  total: number,
): string {
  if (!element) return String(total);

  if (element.kind === 'habit') {
    const config = parseHabitConfig(element.config);
    if (config.trackingMode === 'timer') {
      return total > 0 ? formatHabitTimerDuration(total) : '—';
    }
    return isHabitDayComplete(total, config) ? 'Done' : '—';
  }

  const unit = CounterConfigSchema.parse(element.config).unit;
  return `${total} ${unit}`;
}

export function truncateNotePreview(body: string, max = 48): string {
  const oneLine = body.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
