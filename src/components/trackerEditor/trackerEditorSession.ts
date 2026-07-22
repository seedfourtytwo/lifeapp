import { toDateString, type CounterConfig, type HabitConfig, getHabitTimerPlaybackMode } from '../../protocol';
import { newId } from '../../utils/id';
import type { TrackerEditorSession } from './types';

export function newEditorSession(
  overrides: Partial<TrackerEditorSession> & Pick<TrackerEditorSession, 'mode'>,
): TrackerEditorSession {
  return {
    sessionId: newId(),
    editingId: null,
    name: '',
    increments: '5, 10',
    dailyTarget: '',
    targetLabel: '',
    habitTrackingMode: 'boolean',
    habitDailyGoalMinutes: '',
    habitSoundTrackId: '',
    habitSoundPlaybackMode: 'play_once',
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
    showStreakOnCard: false,
    ...overrides,
  };
}

export function editorSessionFromCounter(
  id: string,
  name: string,
  config: CounterConfig,
): TrackerEditorSession {
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
): TrackerEditorSession {
  const schedule = config.schedule;
  const timerSound = config.timerSound;
  return newEditorSession({
    mode: 'habit',
    editingId: id,
    name,
    targetLabel: config.targetLabel ?? '',
    habitTrackingMode: config.trackingMode,
    habitDailyGoalMinutes: config.dailyTargetSeconds
      ? String(Math.round(config.dailyTargetSeconds / 60))
      : '',
    habitSoundTrackId: timerSound?.trackId ?? '',
    habitSoundPlaybackMode: timerSound
      ? getHabitTimerPlaybackMode(timerSound)
      : 'play_once',
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
    showStreakOnCard: config.showStreakOnCard ?? false,
  });
}
