import type { HabitSchedule, HabitTrackingMode, HabitTimerPlaybackMode, TrackerIconId } from '../../protocol';

export type HabitScheduleType = HabitSchedule['type'];

export type TrackerEditorMode = 'counter' | 'habit';

export type TrackerEditorSession = {
  sessionId: string;
  mode: TrackerEditorMode;
  editingId: string | null;
  name: string;
  icon: TrackerIconId | null;
  increments: string;
  dailyTarget: string;
  targetLabel: string;
  habitTrackingMode: HabitTrackingMode;
  habitDailyGoalMinutes: string;
  habitSoundTrackId: string;
  habitSoundPlaybackMode: HabitTimerPlaybackMode;
  useTimeRange: boolean;
  timeRangeStart: string;
  timeRangeEnd: string;
  visibleOnlyInTimeRange: boolean;
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleInterval: string;
  scheduleAnchorDate: string;
  useReminder: boolean;
  remindMinutesBefore: string;
  showStreakOnCard: boolean;
};

export type TrackerEditorSaveData =
  | {
      mode: 'counter';
      name: string;
      icon: TrackerIconId | null;
      increments: string;
      dailyTarget: string;
      showStreakOnCard: boolean;
    }
  | {
      mode: 'habit';
      name: string;
      icon: TrackerIconId | null;
      targetLabel: string;
      habitTrackingMode: HabitTrackingMode;
      habitDailyGoalMinutes: string;
      habitSoundTrackId: string;
      habitSoundPlaybackMode: HabitTimerPlaybackMode;
      useTimeRange: boolean;
      timeRangeStart: string;
      timeRangeEnd: string;
      visibleOnlyInTimeRange: boolean;
      scheduleType: HabitScheduleType;
      scheduleWeekdays: number[];
      scheduleInterval: string;
      scheduleAnchorDate: string;
      useReminder: boolean;
      remindMinutesBefore: string;
      showStreakOnCard: boolean;
    };

export type HabitEditorFieldState = Pick<
  TrackerEditorSession,
  | 'targetLabel'
  | 'habitTrackingMode'
  | 'habitDailyGoalMinutes'
  | 'habitSoundTrackId'
  | 'habitSoundPlaybackMode'
  | 'useTimeRange'
  | 'timeRangeStart'
  | 'timeRangeEnd'
  | 'visibleOnlyInTimeRange'
  | 'scheduleType'
  | 'scheduleWeekdays'
  | 'scheduleInterval'
  | 'scheduleAnchorDate'
  | 'useReminder'
  | 'remindMinutesBefore'
  | 'showStreakOnCard'
>;
