import {
  activeTimerElapsedSeconds,
  dayOutcome,
  factsFromTotal,
  habitTimerGoal,
  habitTimerTrack,
  isHabitScheduledOnDate,
  lampsPassed,
  nextLamp,
  toDateString,
  usableInsteadHabits,
  type ActiveTimerSession,
  type CommitmentElement,
  type CounterElement,
  type DayFacts,
  type ElementDefinition,
  type HabitElement,
} from '../protocol';
import type { UrgeRide } from '../store/urgeStore';
import { createdOnLocalDate } from '../utils/createdOnLocalDate';
import { dayStrip } from '../utils/dayStrip';
import {
  WIDGET_SNAPSHOT_VERSION,
  type WidgetSnapshot,
  type WidgetSnapshotTracker,
} from '../protocol/widgetSnapshot';
import {
  habitReminderClockTimes,
  reminderMomentsOn,
} from '../notifications/habitStartReminderTimes';

export interface WidgetSnapshotInput {
  /** The trackers on Home, already in Home's order. */
  trackers: readonly ElementDefinition[];
  /** Today's facts per tracker, as SQLite holds them. */
  factsById: ReadonlyMap<string, DayFacts>;
  /** Each tracker's facts for at least the last fourteen days, by date; a day missing logged nothing. */
  recentFacts: ReadonlyMap<string, ReadonlyMap<string, DayFacts>>;
  habitStreaks: Readonly<Record<string, number>>;
  counterStreaks: Readonly<Record<string, number>>;
  commitmentStreak: number;
  sessions: Readonly<Record<string, ActiveTimerSession>>;
  urges: { ride: UrgeRide | null; urgesToday: number; riddenOutTotal: number };
  /** A lamp's short label ("48h", "5d") in the app's language. */
  lampLabel: (hours: number) => string;
  now: Date;
  timeZone: string;
}

function strip(
  tracker: ElementDefinition,
  input: WidgetSnapshotInput,
  today: string,
  length: number,
) {
  return dayStrip(
    tracker,
    input.recentFacts.get(tracker.id) ?? new Map<string, DayFacts>(),
    today,
    createdOnLocalDate(tracker.createdAt),
    length,
  );
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
    sevenDays: strip(habit, input, today, 7),
    trackingMode: config.trackingMode,
    unit: isTimer ? 'seconds' : 'ticks',
    timeRange: config.timeRange ?? null,
    visibleOnlyInTimeRange: config.visibleOnlyInTimeRange === true,
    timer: isTimer ? { goal, ...habitTimerTrack(config.timerSound), session } : null,
  };
}

function counterTracker(
  counter: CounterElement,
  input: WidgetSnapshotInput,
  today: string,
): WidgetSnapshotTracker {
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
    sevenDays: strip(counter, input, today, 7),
    unit: counter.config.unit,
    quickIncrements: counter.config.quickIncrements,
  };
}

function commitmentTracker(
  commitment: CommitmentElement,
  input: WidgetSnapshotInput,
  today: string,
): WidgetSnapshotTracker {
  const outcome = dayOutcome(commitment, input.factsById.get(commitment.id) ?? factsFromTotal(0));
  return {
    kind: 'commitment',
    id: commitment.id,
    name: commitment.name,
    lockScreenName: commitment.config.lockScreenName,
    icon: null,
    dueToday: true,
    done: outcome.done,
    reason: outcome.reason,
    total: outcome.total,
    target: null,
    streak: input.commitmentStreak,
    schedule: { type: 'daily' },
    reminderTimes: [],
    sevenDays: strip(commitment, input, today, 7),
    unit: 'slips',
  };
}

function commitmentBlock(
  commitment: CommitmentElement,
  input: WidgetSnapshotInput,
  today: string,
): NonNullable<WidgetSnapshot['commitment']> {
  const { config } = commitment;
  const { now } = input;
  const lamp = nextLamp(config.clearSince, now);
  return {
    id: commitment.id,
    lockScreenName: config.lockScreenName,
    clearSince: config.clearSince,
    lampsPassed: lampsPassed(config.clearSince, now),
    nextLamp: { at: lamp.at.toISOString(), hours: lamp.hours, label: input.lampLabel(lamp.hours) },
    ownLines: config.ownLines,
    rideSeconds: config.rideSeconds,
    urgesRiddenOut: input.urges.riddenOutTotal,
    urgesToday: input.urges.urgesToday,
    insteadHabits: usableInsteadHabits(config, input.trackers).map((habit) => {
      const goal = habitTimerGoal(habit.config);
      return {
        id: habit.id,
        lockScreenName: habit.config.lockScreenName ?? null,
        icon: habit.config.icon ?? null,
        goalSeconds: goal.type === 'seconds' ? goal.seconds : null,
      };
    }),
    days: strip(commitment, input, today, 14).map(({ date, state }) => ({
      date,
      state: state === 'not_done' ? 'slip' : state === 'not_counted' ? 'not_counted' : 'done',
    })),
  };
}

/** Today as the widget will show it; pure, so the same input gives the same file. */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const { now } = input;
  const today = toDateString(now);
  const trackers = input.trackers.flatMap((tracker): WidgetSnapshotTracker[] => {
    switch (tracker.kind) {
      case 'habit':
        return [habitTracker(tracker, input, today)];
      case 'counter':
        return [counterTracker(tracker, input, today)];
      case 'commitment':
        return [commitmentTracker(tracker, input, today)];
      default: {
        const unknown: never = tracker;
        throw new Error(`Unknown tracker kind ${JSON.stringify(unknown)}`);
      }
    }
  });

  const commitment = input.trackers.find(
    (tracker): tracker is CommitmentElement => tracker.kind === 'commitment',
  );

  const nextReminders = input.trackers
    .flatMap((tracker) => {
      if (tracker.kind !== 'habit') return [];
      const shown = trackers.find((item) => item.id === tracker.id);
      if (!shown?.dueToday || shown.done) return [];
      return shown.reminderTimes.flatMap((time) =>
        reminderMomentsOn(tracker.config.schedule, [time], today)
          .filter((moment) => moment.getTime() > now.getTime())
          .map((moment) => ({ trackerId: tracker.id, time, at: moment.toISOString() })),
      );
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
    commitment: commitment ? commitmentBlock(commitment, input, today) : null,
    ride: input.urges.ride,
    nextReminders,
  };
}
