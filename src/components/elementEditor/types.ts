import type { HabitSchedule, HabitTimeSlot, HabitTrackingMode } from '../../protocol';

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
  habitSoundId: string;
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
      habitSoundId: string;
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
    };

export type HabitEditorFieldState = Pick<
  ElementEditorSession,
  | 'targetLabel'
  | 'habitTrackingMode'
  | 'habitDailyGoalMinutes'
  | 'habitSoundId'
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
>;
