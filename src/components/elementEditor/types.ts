import type { HabitSchedule, HabitTimeSlot, HabitTrackingMode, HabitTimerPlaybackMode } from '../../protocol';

export type HabitScheduleType = HabitSchedule['type'];

export type ElementEditorMode = 'counter' | 'habit';

export type ElementEditorSession = {
  sessionId: string;
  mode: ElementEditorMode;
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

export type ElementEditorSaveData =
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
  ElementEditorSession,
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
