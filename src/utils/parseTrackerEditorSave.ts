import type { TrackerEditorSaveData } from '../components/trackerEditor/types';
import { i18n } from '../i18n';
import {
  buildHabitTimerSound,
  type CounterInput,
  type HabitInput,
  type HabitSchedule,
} from '../protocol';
import { parseTimeHHmm } from './time';

/** The part of the form a problem belongs to — where its message is shown. */
export type TrackerEditorField =
  | 'increments'
  | 'dailyTarget'
  | 'dailyGoalMinutes'
  | 'weekdays'
  | 'timesPerWeek'
  | 'interval'
  | 'anchorDate'
  | 'timeRange'
  | 'remindMinutesBefore';

export type TrackerEditorProblem = {
  field: TrackerEditorField;
  /** Already translated: the sentence to put under the field. */
  message: string;
};

/** What the store is handed once everything checks out. */
export type TrackerEditorSaved =
  | { ok: true; kind: 'counter'; input: CounterInput }
  | { ok: true; kind: 'habit'; input: HabitInput };

export type TrackerEditorSaveResult = TrackerEditorSaved | ({ ok: false } & TrackerEditorProblem);

/** Carries a problem out of the nested parsers; never leaves this module. */
class FieldProblem extends Error {
  constructor(
    readonly field: TrackerEditorField,
    messageKey: string,
  ) {
    super(i18n.t(messageKey));
  }
}

type HabitSaveData = Extract<TrackerEditorSaveData, { mode: 'habit' }>;

function parseIncrements(raw: string): number[] {
  const values = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (values.length === 0) {
    throw new FieldProblem('increments', 'trackers:validation.incrementsRequired');
  }
  return values;
}

function parseDailyTarget(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = parseInt(trimmed, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new FieldProblem('dailyTarget', 'trackers:validation.dailyTargetPositive');
  }
  return value;
}

function parseDailyGoalSeconds(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes <= 0) {
    throw new FieldProblem('dailyGoalMinutes', 'trackers:validation.dailyGoalPositive');
  }
  return minutes * 60;
}

function parseSchedule(data: HabitSaveData): HabitSchedule {
  if (data.scheduleType === 'daily') {
    return { type: 'daily' };
  }
  if (data.scheduleType === 'weekdays') {
    if (data.scheduleWeekdays.length === 0) {
      throw new FieldProblem('weekdays', 'trackers:validation.pickAtLeastOneDay');
    }
    return { type: 'weekdays', days: [...data.scheduleWeekdays].sort() };
  }
  if (data.scheduleType === 'times_per_week') {
    const times = parseInt(data.scheduleTimesPerWeek.trim(), 10);
    if (Number.isNaN(times) || times < 1 || times > 6) {
      throw new FieldProblem('timesPerWeek', 'trackers:validation.timesPerWeekRange');
    }
    return { type: 'times_per_week', times };
  }
  const interval = parseInt(data.scheduleInterval.trim(), 10);
  if (Number.isNaN(interval) || interval < 1) {
    throw new FieldProblem('interval', 'trackers:validation.intervalMin1');
  }
  const anchorDate = data.scheduleAnchorDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    throw new FieldProblem('anchorDate', 'trackers:validation.firstDayFormat');
  }
  return { type: 'every_n_days', interval, anchorDate };
}

function parseRemindMinutes(
  data: HabitSaveData,
  hasTimeRange: boolean,
): number | undefined {
  if (!hasTimeRange || !data.useReminder) return undefined;
  const trimmed = data.remindMinutesBefore.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes < 0) {
    throw new FieldProblem('remindMinutesBefore', 'trackers:validation.reminderMinutesNonNegative');
  }
  return minutes;
}

function parseTimeRange(data: HabitSaveData): { start: string; end: string } | undefined {
  if (!data.useTimeRange) {
    if (data.visibleOnlyInTimeRange) {
      throw new FieldProblem('timeRange', 'trackers:validation.timeRangeRequiredForVisibility');
    }
    return undefined;
  }
  const start = parseTimeHHmm(data.timeRangeStart);
  const end = parseTimeHHmm(data.timeRangeEnd);
  if (!start || !end) {
    throw new FieldProblem('timeRange', 'trackers:validation.timeRangeFormat');
  }
  return { start, end };
}

function parseCounter(data: Extract<TrackerEditorSaveData, { mode: 'counter' }>): CounterInput {
  return {
    name: data.name,
    icon: data.icon ?? undefined,
    quickIncrements: parseIncrements(data.increments),
    dailyTarget: parseDailyTarget(data.dailyTarget),
    showStreakOnCard: data.showStreakOnCard,
  };
}

/** Checked in the order the form reads, so the first problem is the topmost one. */
function parseHabit(data: HabitSaveData): HabitInput {
  const timer = data.habitTrackingMode === 'timer';
  const dailyTargetSeconds = timer ? parseDailyGoalSeconds(data.habitDailyGoalMinutes) : undefined;
  const schedule = parseSchedule(data);
  const timeRange = parseTimeRange(data);
  const remindMinutesBefore = parseRemindMinutes(data, Boolean(timeRange));

  return {
    name: data.name,
    icon: data.icon ?? undefined,
    trackingMode: data.habitTrackingMode,
    // Time-of-day slots no longer drive list filters/order — keep protocol field stable.
    timeSlot: 'anytime',
    targetLabel: timer ? undefined : data.targetLabel || undefined,
    dailyTargetSeconds,
    timerSound: timer
      ? buildHabitTimerSound({
          trackId: data.habitSoundTrackId,
          playbackMode: data.habitSoundPlaybackMode,
        })
      : undefined,
    anySessionCounts: timer && data.anySessionCounts,
    timeRange,
    visibleOnlyInTimeRange: data.visibleOnlyInTimeRange,
    schedule,
    remindMinutesBefore,
    showStreakOnCard: data.showStreakOnCard,
  };
}

/**
 * Turns what the editor holds into what the store saves — or says which field
 * stops it. A problem is a value, not an exception: the editor shows it under
 * the field instead of the screen catching it into a pop-up.
 */
export function parseTrackerEditorSave(data: TrackerEditorSaveData): TrackerEditorSaveResult {
  try {
    return data.mode === 'counter'
      ? { ok: true, kind: 'counter', input: parseCounter(data) }
      : { ok: true, kind: 'habit', input: parseHabit(data) };
  } catch (error) {
    if (error instanceof FieldProblem) {
      return { ok: false, field: error.field, message: error.message };
    }
    throw error;
  }
}
