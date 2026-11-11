import {
  activeTimerElapsedSeconds,
  dayOutcome,
  factsFromTotal,
  habitTimerGoal,
  isHabitScheduledOnDate,
  toDateString,
  type ActiveTimerSession,
  type CounterElement,
  type DayFacts,
  type ElementDefinition,
  type HabitElement,
} from '../protocol';
import {
  WIDGET_SNAPSHOT_VERSION,
  type WidgetSnapshot,
  type WidgetSnapshotTracker,
} from '../protocol/widgetSnapshot';
import {
  collectStartReminderFires,
  habitReminderClockTimes,
} from '../notifications/habitStartReminderTimes';

export interface WidgetSnapshotInput {
  /** The trackers on Home, already in Home's order. */
  trackers: readonly ElementDefinition[];
  /** Today's facts per tracker, as SQLite holds them. */
  factsById: ReadonlyMap<string, DayFacts>;
  habitStreaks: Readonly<Record<string, number>>;
  counterStreaks: Readonly<Record<string, number>>;
  sessions: Readonly<Record<string, ActiveTimerSession>>;
  now: Date;
  timeZone: string;
}

function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function habitTracker(
  habit: HabitElement,
  input: WidgetSnapshotInput,
  today: string,
): WidgetSnapshotTracker {
  const { config } = habit;
  const outcome = dayOutcome(habit, input.factsById.get(habit.id) ?? factsFromTotal(0));
  const isTimer = config.trackingMode === 'timer';
  const goal = habitTimerGoal(config);
  const saved = isTimer ? input.sessions[habit.id] : undefined;
  const session = saved
    ? {
        startedAt: saved.startedAt,
        pausedAt: saved.pausedAt,
        pausedMs: saved.pauseOffsetMs,
        elapsedSeconds: activeTimerElapsedSeconds(saved, input.now.getTime()),
        paused: saved.pausedAt !== null,
      }
    : null;
  // A running session is judged by today's goal, as the app's own card is.
  const pastGoal =
    !outcome.done &&
    session !== null &&
    goal.type === 'seconds' &&
    outcome.total + session.elapsedSeconds >= goal.seconds;

  return {
    kind: 'habit',
    id: habit.id,
    name: habit.name,
    lockScreenName: config.lockScreenName ?? null,
    icon: config.icon ?? null,
    dueToday: isHabitScheduledOnDate(config, today),
    done: outcome.done || pastGoal,
    reason: pastGoal ? 'running_past_goal' : outcome.reason,
    total: outcome.total,
    target: outcome.target ?? null,
    streak: input.habitStreaks[habit.id] ?? 0,
    schedule: config.schedule,
    reminderTimes: habitReminderClockTimes(config),
    trackingMode: config.trackingMode,
    unit: isTimer ? 'seconds' : 'ticks',
    timeRange: config.timeRange ?? null,
    visibleOnlyInTimeRange: config.visibleOnlyInTimeRange === true,
    timer: isTimer ? { goal, session } : null,
  };
}

function counterTracker(counter: CounterElement, input: WidgetSnapshotInput): WidgetSnapshotTracker {
  const outcome = dayOutcome(counter, input.factsById.get(counter.id) ?? factsFromTotal(0));
  return {
    kind: 'counter',
    id: counter.id,
    name: counter.name,
    lockScreenName: null,
    icon: counter.config.icon ?? null,
    dueToday: true,
    done: outcome.done,
    reason: outcome.reason,
    total: outcome.total,
    target: outcome.target ?? null,
    streak: input.counterStreaks[counter.id] ?? 0,
    schedule: { type: 'daily' },
    reminderTimes: [],
    unit: counter.config.unit,
    quickIncrements: counter.config.quickIncrements,
  };
}

/** Today as the widget will show it; pure, so the same input gives the same file. */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const { now } = input;
  const today = toDateString(now);
  const trackers = input.trackers.map((tracker) =>
    tracker.kind === 'habit' ? habitTracker(tracker, input, today) : counterTracker(tracker, input),
  );

  const nextReminders = input.trackers
    .flatMap((tracker) => {
      if (tracker.kind !== 'habit') return [];
      const shown = trackers.find((item) => item.id === tracker.id);
      if (!shown?.dueToday) return [];
      return collectStartReminderFires(tracker.config, {
        now,
        doneToday: shown.done,
        horizonDays: 1,
      }).map((fire) => ({ trackerId: tracker.id, time: fire.time, at: fire.when.toISOString() }));
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    day: {
      date: today,
      endsAt: nextLocalMidnight(now).toISOString(),
      timeZone: input.timeZone,
      utcOffsetMinutes: -now.getTimezoneOffset(),
    },
    trackers,
    nextReminders,
  };
}
