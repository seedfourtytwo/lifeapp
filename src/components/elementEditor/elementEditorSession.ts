import { toDateString, type CounterConfig, type HabitConfig } from '../../protocol';
import { newId } from '../../utils/id';
import type { ElementEditorSession } from './types';

export function newEditorSession(
  overrides: Partial<ElementEditorSession> & Pick<ElementEditorSession, 'mode'>,
): ElementEditorSession {
  return {
    sessionId: newId(),
    editingId: null,
    name: '',
    increments: '5, 10',
    dailyTarget: '',
    targetLabel: '',
    habitTrackingMode: 'boolean',
    habitDailyGoalMinutes: '',
    habitSoundId: '',
    timeSlot: 'morning',
    useTimeRange: false,
    timeRangeStart: '',
    timeRangeEnd: '',
    visibleOnlyInTimeRange: false,
    scheduleType: 'daily',
    scheduleWeekdays: [1, 2, 3, 4, 5],
    scheduleInterval: '2',
    scheduleAnchorDate: toDateString(new Date()),
    useReminder: false,
    remindMinutesBefore: '15',
    ...overrides,
  };
}

export function editorSessionFromCounter(
  id: string,
  name: string,
  config: CounterConfig,
): ElementEditorSession {
  return newEditorSession({
    mode: 'counter',
    editingId: id,
    name,
    increments: config.quickIncrements.join(', '),
    dailyTarget: config.dailyTarget ? String(config.dailyTarget) : '',
  });
}

export function editorSessionFromHabit(
  id: string,
  name: string,
  config: HabitConfig,
): ElementEditorSession {
  const schedule = config.schedule;
  return newEditorSession({
    mode: 'habit',
    editingId: id,
    name,
    targetLabel: config.targetLabel ?? '',
    habitTrackingMode: config.trackingMode,
    habitDailyGoalMinutes: config.dailyTargetSeconds
      ? String(Math.round(config.dailyTargetSeconds / 60))
      : '',
    habitSoundId: config.soundId ?? '',
    timeSlot: config.timeSlot,
    useTimeRange: Boolean(config.timeRange),
    timeRangeStart: config.timeRange?.start ?? '',
    timeRangeEnd: config.timeRange?.end ?? '',
    visibleOnlyInTimeRange: config.visibleOnlyInTimeRange ?? false,
    scheduleType: schedule.type,
    scheduleWeekdays: schedule.type === 'weekdays' ? schedule.days : [1, 2, 3, 4, 5],
    scheduleInterval: schedule.type === 'every_n_days' ? String(schedule.interval) : '2',
    scheduleAnchorDate:
      schedule.type === 'every_n_days' ? schedule.anchorDate : toDateString(new Date()),
    useReminder: config.remindMinutesBefore !== undefined,
    remindMinutesBefore:
      config.remindMinutesBefore !== undefined ? String(config.remindMinutesBefore) : '15',
  });
}
