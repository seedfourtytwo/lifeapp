import type { TrackerEditorSaveData } from '../components/trackerEditor/types';
import { i18n } from '../i18n';
import {
  buildHabitTimerSound,
  normalizeLockScreenName,
  isScheduleSupportedForReminders,
  OWN_LINE_MAX_LENGTH,
  type CommitmentInput,
  type CounterInput,
  type HabitInput,
  type HabitSchedule,
} from '../protocol';
import { withReminderTime } from './reminderTimes';
import { toDateString } from '../protocol/event';
import { formatLocalClockTime, parseTimeHHmm } from './time';

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

/** The listed times, plus one still in the field so Save does not lose it. */
function parseReminderTimes(data: Extract<TrackerEditorSaveData, { mode: 'habit' }>): string[] {
  if (!data.reminderTimeDraft.trim()) return data.reminderTimes;
  const times = withReminderTime(data.reminderTimes, data.reminderTimeDraft);
  if (!times) {
    throw new Error(i18n.t('trackers:validation.reminderTimeFormat'));
  }
  return times;
}

/** The listed lines, plus one still in the field so Save does not lose it. */
function parseOwnLines(data: CommitmentSaveData): string[] {
  const lines = [...data.ownLines, data.ownLineDraft].map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => line.length > OWN_LINE_MAX_LENGTH)) {
    throw new Error(i18n.t('trackers:validation.ownLineTooLong', { max: OWN_LINE_MAX_LENGTH }));
  }
  return lines;
}

type CommitmentSaveData = Extract<TrackerEditorSaveData, { mode: 'commitment' }>;

/**
 * When the clock starts: unset when both fields are empty, the instant it
 * already had when the fields still show it (to the minute), else the local
 * moment typed, which may not be in the future.
 */
function parseClearSince(data: CommitmentSaveData, now: Date): string | undefined {
  const date = data.clearSinceDate.trim();
  const time = parseTimeHHmm(data.clearSinceTime);
  if (date === '' && data.clearSinceTime.trim() === '') return undefined;
  const at = data.clearSinceAt ? new Date(data.clearSinceAt) : null;
  if (at && toDateString(at) === date && formatLocalClockTime(at) === time) return data.clearSinceAt!;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time ?? '').split(':').map(Number);
  const moment = new Date(year, month - 1, day, hour, minute);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || time === null || toDateString(moment) !== date) {
    throw new Error(i18n.t('trackers:validation.clearSinceFormat'));
  }
  if (moment.getTime() > now.getTime()) {
    throw new Error(i18n.t('trackers:validation.clearSinceInFuture'));
  }
  return moment.toISOString();
}

export type ParsedTrackerEditorSave =
  | { kind: 'counter'; input: CounterInput }
  | { kind: 'habit'; input: HabitInput }
  | { kind: 'commitment'; input: CommitmentInput };

export function parseTrackerEditorSave(data: TrackerEditorSaveData): ParsedTrackerEditorSave {
  if (data.mode === 'commitment') {
    return {
      kind: 'commitment',
      input: {
        name: data.name,
        lockScreenName: data.lockScreenName,
        ownLines: parseOwnLines(data),
        insteadHabitIds: data.insteadHabitIds,
        clearSince: parseClearSince(data, new Date()),
        rideSeconds: data.rideMinutes * 60,
      },
    };
  }
  if (data.mode === 'counter') {
    return {
      kind: 'counter',
      input: {
        name: data.name,
        icon: data.icon ?? undefined,
        quickIncrements: parseIncrements(data.increments),
        dailyTarget: parseDailyTarget(data.dailyTarget),
        showStreakOnCard: data.showStreakOnCard,
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
      icon: data.icon ?? undefined,
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
      reminderTimes: parseReminderTimes(data),
      showStreakOnCard: data.showStreakOnCard,
      lockScreenName: normalizeLockScreenName(data.lockScreenName),
    },
  };
}
