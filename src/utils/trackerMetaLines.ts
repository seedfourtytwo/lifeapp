import type { CounterConfig, HabitConfig } from '../protocol';
import {
  formatHabitDescription,
  formatHabitTimerSoundSummary,
  formatScheduleDescription,
} from '../protocol';

export function counterMetaLines(config: CounterConfig): string[] {
  const buttons = config.quickIncrements.map((n) => `+${n}`).join(', ');
  const goal = config.dailyTarget ? ` · Goal: ${config.dailyTarget}/day` : '';
  return [`Buttons: ${buttons}${goal}`];
}

export function habitMetaLines(config: HabitConfig): string[] {
  const lines: string[] = [];
  const description = formatHabitDescription(config);
  if (description) lines.push(description);
  lines.push(formatScheduleDescription(config.schedule));
  if (config.trackingMode === 'timer' && config.dailyTargetSeconds) {
    lines.push(`Goal: ${Math.round(config.dailyTargetSeconds / 60)} min/day`);
  }
  if (config.remindMinutesBefore !== undefined && config.timeRange) {
    lines.push(
      `Reminder: ${config.remindMinutesBefore} min before ${config.timeRange.start}`,
    );
  }
  const soundSummary = formatHabitTimerSoundSummary(config.timerSound);
  if (soundSummary) lines.push(`Sound: ${soundSummary}`);
  return lines;
}
