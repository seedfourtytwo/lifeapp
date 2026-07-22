import { i18n } from '../i18n';
import type { CounterConfig, HabitConfig } from '../protocol';
import {
  formatHabitDescription,
  formatHabitTimerSoundSummary,
  formatScheduleDescription,
} from '../protocol';

export function counterMetaLines(config: CounterConfig): string[] {
  const buttons = config.quickIncrements.map((n) => `+${n}`).join(', ');
  const goal = config.dailyTarget
    ? i18n.t('trackers:metaLines.goalPerDay', { target: config.dailyTarget })
    : '';
  return [`${i18n.t('trackers:metaLines.buttons', { list: buttons })}${goal}`];
}

export function habitMetaLines(config: HabitConfig): string[] {
  const lines: string[] = [];
  const description = formatHabitDescription(config);
  if (description) lines.push(description);
  lines.push(formatScheduleDescription(config.schedule));
  if (config.trackingMode === 'timer' && config.dailyTargetSeconds) {
    lines.push(
      i18n.t('trackers:metaLines.goalMinPerDay', {
        minutes: Math.round(config.dailyTargetSeconds / 60),
      }),
    );
  }
  if (config.remindMinutesBefore !== undefined && config.timeRange) {
    lines.push(
      i18n.t('trackers:metaLines.reminder', {
        minutes: config.remindMinutesBefore,
        time: config.timeRange.start,
      }),
    );
  }
  const soundSummary = formatHabitTimerSoundSummary(config.timerSound);
  if (soundSummary) lines.push(i18n.t('trackers:metaLines.sound', { summary: soundSummary }));
  return lines;
}
