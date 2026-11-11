import type { HabitSchedule, HabitTrackingMode, HabitTimerPlaybackMode, TrackerIconId } from '../../protocol';

export type HabitScheduleType = HabitSchedule['type'];

export type TrackerEditorMode = 'counter' | 'habit' | 'commitment';

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
  reminderTimes: string[];
  /** A time typed into the Reminders row but not yet added. */
  reminderTimeDraft: string;
  showStreakOnCard: boolean;
  lockScreenName: string;
  /** A commitment's lines in his own words. */
  ownLines: string[];
  /** A line typed but not yet added. */
  ownLineDraft: string;
  /** A commitment's timed habits offered instead of the urge. */
  insteadHabitIds: string[];
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
      reminderTimes: string[];
      reminderTimeDraft: string;
      showStreakOnCard: boolean;
      lockScreenName: string;
    }
  | ({ mode: 'commitment'; name: string } & CommitmentEditorFieldState);

export type CommitmentEditorFieldState = Pick<
  TrackerEditorSession,
  'lockScreenName' | 'ownLines' | 'ownLineDraft' | 'insteadHabitIds'
>;

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
  | 'reminderTimes'
  | 'reminderTimeDraft'
  | 'showStreakOnCard'
  | 'lockScreenName'
>;
