import { useEffect, useMemo } from 'react';
import { useRefreshHabitDayOnFocus } from '../../hooks/useHabitDataRefresh';
import {
  filterHabitsDueToday,
  parseHabitConfig,
  type ElementDefinition,
  type HabitConfig,
} from '../../protocol';
import { useElementStore } from '../../store/elementStore';
import { isRunningInWidget, isSkippedToday, useEventStore } from '../../store/eventStore';
import { getActiveHabits } from '../../utils/dashboardElements';
import { currentAppCalendarDate } from '../../utils/dayRollover';
import { idSet } from './idSet';
import type { TodayHabitFacts } from './todayModel';

export type TodayHabits = {
  /** Every active habit, in the user's order — the strip and the notes cover all of them. */
  activeIds: string[];
  /** Today's facts for the model, in the user's order. */
  facts: TodayHabitFacts[];
  byId: ReadonlyMap<string, ElementDefinition>;
  configs: ReadonlyMap<string, HabitConfig>;
  /** Best day run among the habits listed today; weekly habits count weeks and stay out. */
  bestStreak: number;
  /** Habits that exist at all, archived included. */
  totalCount: number;
  /** Elements, or today's completion map, have not landed yet. */
  waiting: boolean;
};

/**
 * The habits half of Today: which are offered, done, skipped or being timed.
 *
 * Everything read from the event store is a derived primitive — a joined id
 * list or a number — so a tick re-renders the page only when a row has to
 * change section or the header figure moves. Each card reads its own slice
 * (see `HabitCard`), which is what keeps a tick to one card.
 */
export function useTodayHabits(now: Date): TodayHabits {
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const isLoading = useElementStore((s) => s.isLoading);
  const dayStateReady = useEventStore((s) => s.dayStateReady);

  useRefreshHabitDayOnFocus();

  const active = useMemo(() => getActiveHabits(elements, dashboard), [elements, dashboard]);
  const activeIds = useMemo(() => active.map((habit) => habit.id), [active]);
  const byId = useMemo(() => new Map(active.map((habit) => [habit.id, habit])), [active]);
  const configs = useMemo(() => {
    const parsed = new Map<string, HabitConfig>();
    for (const habit of active) parsed.set(habit.id, parseHabitConfig(habit.config));
    return parsed;
  }, [active]);
  const totalCount = useMemo(
    () => elements.filter((element) => element.kind === 'habit').length,
    [elements],
  );

  // Due-ness depends on the day and the configs — and, for a times-a-week habit
  // only, on this week's done days. Subscribe to that slice as a string, so a
  // tick on an ordinary habit never re-runs the filter.
  const weeklyIds = useMemo(
    () => activeIds.filter((id) => configs.get(id)?.schedule.type === 'times_per_week'),
    [activeIds, configs],
  );
  const weekKey = useEventStore((s) =>
    weeklyIds
      .map(
        (id) =>
          `${id}|${(s.habitWeekDoneBefore[id] ?? []).join(',')}|${s.habitDoneToday[id] ? 1 : 0}`,
      )
      .join('\n'),
  );
  const offeredIds = useMemo(() => {
    const { habitDoneToday, habitWeekDoneBefore } = useEventStore.getState();
    return filterHabitsDueToday(
      active,
      {
        now,
        today: currentAppCalendarDate(now),
        habitDoneToday,
        habitWeekDoneBefore,
        // Skipped rows stay listed (sunk with the done ones) so they can be undone.
        includeSkipped: true,
      },
      configs,
    ).map((habit) => habit.id);
    // `weekKey` stands in for the weekly slice of the store read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, configs, now, weekKey]);

  // A timer left open keeps its row even on a day the habit is not offered,
  // so "running" is asked of every active habit, not only today's. It is
  // running whoever started it: the app, or the widget's own stopwatch.
  const appTimersKey = useEventStore((s) =>
    activeIds.filter((id) => s.activeTimerSessions[id] != null).join('\n'),
  );
  const widgetTimersKey = useEventStore((s) =>
    activeIds.filter((id) => isRunningInWidget(s, id)).join('\n'),
  );
  const runningKey = useMemo(
    () => [...new Set([...idSet(appTimersKey), ...idSet(widgetTimersKey)])].join('\n'),
    [appTimersKey, widgetTimersKey],
  );
  // The widget writes from its own process, so its timers are re-read: on the
  // way in, with every refresh of today from SQLite (`refreshTodayFromDb`), and
  // whenever an app timer starts or stops — taking a timer over from the widget
  // stops the widget's first, and the copy here must not outlive it.
  const loadWidgetTimerSessions = useEventStore((s) => s.loadWidgetTimerSessions);
  useEffect(() => {
    void loadWidgetTimerSessions();
  }, [loadWidgetTimerSessions, appTimersKey]);

  const doneKey = useEventStore((s) =>
    offeredIds.filter((id) => s.habitDoneToday[id] ?? false).join('\n'),
  );
  const skippedKey = useEventStore((s) =>
    offeredIds.filter((id) => isSkippedToday(s, id, s.habitDoneToday[id] ?? false)).join('\n'),
  );

  const facts = useMemo(() => {
    const offered = new Set(offeredIds);
    const done = idSet(doneKey);
    const skipped = idSet(skippedKey);
    const running = idSet(runningKey);
    return activeIds.map((id) => ({
      id,
      offered: offered.has(id),
      done: done.has(id),
      skipped: skipped.has(id),
      running: running.has(id),
    }));
  }, [activeIds, offeredIds, doneKey, skippedKey, runningKey]);

  // The header says days, so a times-a-week habit's run (in weeks) stays out of it.
  const dayStreakIds = useMemo(() => {
    const weekly = new Set(weeklyIds);
    return offeredIds.filter((id) => !weekly.has(id));
  }, [offeredIds, weeklyIds]);
  const bestStreak = useEventStore((s) =>
    dayStreakIds.reduce((best, id) => Math.max(best, s.habitStreaks[id] ?? 0), 0),
  );

  // Wait for elements, then for today's completion map before enabling toggles
  // (a toggle before day-state lands would double-tick).
  const waiting = (isLoading && elements.length === 0) || (active.length > 0 && !dayStateReady);

  return { activeIds, facts, byId, configs, bestStreak, totalCount, waiting };
}
