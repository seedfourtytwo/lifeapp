import type { ElementEditorSaveData } from '../components/elementEditor/types';
import {
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
    throw new Error('Enter at least one positive number (e.g. 5, 10)');
  }
  return values;
}

function parseDailyTarget(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = parseInt(trimmed, 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error('Daily target must be a positive whole number');
  }
  return value;
}

function parseDailyGoalSeconds(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes <= 0) {
    throw new Error('Daily goal must be a positive number of minutes');
  }
  return minutes * 60;
}

function parseSchedule(data: Extract<ElementEditorSaveData, { mode: 'habit' }>): HabitSchedule {
  if (data.scheduleType === 'daily') {
    return { type: 'daily' };
  }
  if (data.scheduleType === 'weekdays') {
    if (data.scheduleWeekdays.length === 0) {
      throw new Error('Pick at least one weekday');
    }
    return { type: 'weekdays', days: [...data.scheduleWeekdays].sort() };
  }
  const interval = parseInt(data.scheduleInterval.trim(), 10);
  if (Number.isNaN(interval) || interval < 1) {
    throw new Error('Interval must be at least 1 day');
  }
  const anchorDate = data.scheduleAnchorDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    throw new Error('Anchor date must be YYYY-MM-DD');
  }
  return { type: 'every_n_days', interval, anchorDate };
}

function parseRemindMinutes(
  data: Extract<ElementEditorSaveData, { mode: 'habit' }>,
  hasTimeRange: boolean,
  schedule: HabitSchedule,
): number | undefined {
  if (!hasTimeRange || !data.useReminder) return undefined;
  if (!isScheduleSupportedForReminders(schedule)) return undefined;
  const trimmed = data.remindMinutesBefore.trim();
  if (!trimmed) return undefined;
  const minutes = parseInt(trimmed, 10);
  if (Number.isNaN(minutes) || minutes < 0) {
    throw new Error('Reminder minutes must be zero or more');
  }
  return minutes;
}

export function parseElementEditorSave(
  data: ElementEditorSaveData,
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
      throw new Error('Enter valid times in HH:mm format, e.g. 06:00');
    }
    timeRange = { start, end };
  }
  if (data.visibleOnlyInTimeRange && !timeRange) {
    throw new Error('Set a time range before limiting visibility');
  }

  const schedule = parseSchedule(data);

  return {
    kind: 'habit',
    input: {
      name: data.name,
      trackingMode: data.habitTrackingMode,
      timeSlot: data.timeSlot,
      targetLabel:
        data.habitTrackingMode === 'boolean' ? data.targetLabel || undefined : undefined,
      dailyTargetSeconds:
        data.habitTrackingMode === 'timer'
          ? parseDailyGoalSeconds(data.habitDailyGoalMinutes)
          : undefined,
      soundId:
        data.habitTrackingMode === 'timer' && data.habitSoundId ? data.habitSoundId : undefined,
      timeRange,
      visibleOnlyInTimeRange: data.visibleOnlyInTimeRange,
      schedule,
      remindMinutesBefore: parseRemindMinutes(data, Boolean(timeRange), schedule),
    },
  };
}
