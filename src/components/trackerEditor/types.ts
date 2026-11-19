import type { NativeMethods } from 'react-native';
import type { HabitSchedule, HabitTrackingMode, HabitTimerPlaybackMode, TrackerIconId } from '../../protocol';
import type { TrackerEditorField, TrackerEditorProblem } from '../../utils/parseTrackerEditorSave';

/**
 * What Save could not accept, handed to the fields so the one at fault can say
 * so, and a way for each field to tell the sheet where it is so the sheet can
 * scroll there.
 */
export type TrackerEditorProblemProps = {
  problem?: TrackerEditorProblem | null;
  anchorRef?: (field: TrackerEditorField) => (node: Pick<NativeMethods, 'measureLayout'> | null) => void;
};

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
  /** `times_per_week` target, '1'–'6'. */
  scheduleTimesPerWeek: string;
  useReminder: boolean;
  remindMinutesBefore: string;
  showStreakOnCard: boolean;
  /** Timer habits: any logged time completes the day. */
  anySessionCounts: boolean;
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
      scheduleTimesPerWeek: string;
      useReminder: boolean;
      remindMinutesBefore: string;
      showStreakOnCard: boolean;
      anySessionCounts: boolean;
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
  | 'scheduleTimesPerWeek'
  | 'useReminder'
  | 'remindMinutesBefore'
  | 'showStreakOnCard'
  | 'anySessionCounts'
>;
