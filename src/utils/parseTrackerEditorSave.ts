import type { TrackerEditorSaveData } from '../components/trackerEditor/types';
import { i18n } from '../i18n';
import {
  buildHabitTimerSound,
  isScheduleSupportedForReminders,
  type CounterInput,
  type HabitInput,
  type HabitSchedule,
} from '../protocol';
import { parseTimeHHmm } from './time';

function parseIncrements(raw: string): number[] {
  const values = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (values.length === 0) {
    throw new Error(i18n.t('trackers:validation.incrementsRequired'));
  }
  return values;
}

function parseDailyTarget(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = parseInt(trimmed, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(i18n.t('trackers:validation.dailyTargetPositive'));
  }
  return value;
}

function parseDailyGoalSeconds(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes <= 0) {
    throw new Error(i18n.t('trackers:validation.dailyGoalPositive'));
  }
  return minutes * 60;
}

function parseSchedule(data: Extract<TrackerEditorSaveData, { mode: 'habit' }>): HabitSchedule {
  if (data.scheduleType === 'daily') {
    return { type: 'daily' };
  }
  if (data.scheduleType === 'weekdays') {
    if (data.scheduleWeekdays.length === 0) {
      throw new Error(i18n.t('trackers:validation.pickAtLeastOneDay'));
    }
    return { type: 'weekdays', days: [...data.scheduleWeekdays].sort() };
  }
  const interval = parseInt(data.scheduleInterval.trim(), 10);
  if (Number.isNaN(interval) || interval < 1) {
    throw new Error(i18n.t('trackers:validation.intervalMin1'));
  }
  const anchorDate = data.scheduleAnchorDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    throw new Error(i18n.t('trackers:validation.firstDayFormat'));
  }
  return { type: 'every_n_days', interval, anchorDate };
}

function parseRemindMinutes(
  data: Extract<TrackerEditorSaveData, { mode: 'habit' }>,
  hasTimeRange: boolean,
  schedule: HabitSchedule,
): number | undefined {
  if (!hasTimeRange || !data.useReminder) return undefined;
  if (!isScheduleSupportedForReminders(schedule)) return undefined;
  const trimmed = data.remindMinutesBefore.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes < 0) {
    throw new Error(i18n.t('trackers:validation.reminderMinutesNonNegative'));
  }
  return minutes;
}

export function parseTrackerEditorSave(
  data: TrackerEditorSaveData,
): { kind: 'counter'; input: CounterInput } | { kind: 'habit'; input: HabitInput } {
  if (data.mode === 'counter') {
    return {
      kind: 'counter',
      input: {
        name: data.name,
        quickIncrements: parseIncrements(data.increments),
        dailyTarget: parseDailyTarget(data.dailyTarget),
      },
    };
  }

  let timeRange: { start: string; end: string } | undefined;
  if (data.useTimeRange) {
    const start = parseTimeHHmm(data.timeRangeStart);
    const end = parseTimeHHmm(data.timeRangeEnd);
    if (!start || !end) {
      throw new Error(i18n.t('trackers:validation.timeRangeFormat'));
    }
    timeRange = { start, end };
  }
  if (data.visibleOnlyInTimeRange && !timeRange) {
    throw new Error(i18n.t('trackers:validation.timeRangeRequiredForVisibility'));
  }

  const schedule = parseSchedule(data);

  const timerSound =
    data.habitTrackingMode === 'timer'
      ? buildHabitTimerSound({
          trackId: data.habitSoundTrackId,
          playbackMode: data.habitSoundPlaybackMode,
        })
      : undefined;

  return {
    kind: 'habit',
    input: {
      name: data.name,
      trackingMode: data.habitTrackingMode,
      // Time-of-day slots no longer drive list filters/order — keep protocol field stable.
      timeSlot: 'anytime',
      targetLabel:
        data.habitTrackingMode === 'boolean' ? data.targetLabel || undefined : undefined,
      dailyTargetSeconds:
        data.habitTrackingMode === 'timer'
          ? parseDailyGoalSeconds(data.habitDailyGoalMinutes)
          : undefined,
      timerSound,
      timeRange,
      visibleOnlyInTimeRange: data.visibleOnlyInTimeRange,
      schedule,
      remindMinutesBefore: parseRemindMinutes(data, Boolean(timeRange), schedule),
      showStreakOnCard: data.showStreakOnCard,
    },
  };
}
