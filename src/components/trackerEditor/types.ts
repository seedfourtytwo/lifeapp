import type { HabitSchedule, HabitTimeSlot, HabitTrackingMode, HabitTimerPlaybackMode } from '../../protocol';

export type HabitScheduleType = HabitSchedule['type'];

export type TrackerEditorMode = 'counter' | 'habit';

export type TrackerEditorSession = {
  sessionId: string;
  mode: TrackerEditorMode;
  editingId: string | null;
  name: string;
  increments: string;
  dailyTarget: string;
  targetLabel: string;
  habitTrackingMode: HabitTrackingMode;
  habitDailyGoalMinutes: string;
  habitSoundTrackId: string;
  habitSoundPlaybackMode: HabitTimerPlaybackMode;
  timeSlot: HabitTimeSlot;
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
      increments: string;
      dailyTarget: string;
    }
  | {
      mode: 'habit';
      name: string;
      targetLabel: string;
      habitTrackingMode: HabitTrackingMode;
      habitDailyGoalMinutes: string;
      habitSoundTrackId: string;
      habitSoundPlaybackMode: HabitTimerPlaybackMode;
      timeSlot: HabitTimeSlot;
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
  | 'timeSlot'
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
