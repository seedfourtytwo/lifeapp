import { useCallback, useMemo, useRef } from 'react';
import { notify } from '../../components/sheet/confirm';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useRefreshCounterTotalsOnFocus } from '../../hooks/useCounterDataRefresh';
import type { RootStackParamList } from '../../navigation/types';
import { CounterConfigSchema, type CounterConfig, type ElementDefinition } from '../../protocol';
import { useElementStore } from '../../store/elementStore';
import { isSkippedToday, useEventStore } from '../../store/eventStore';
import { nextCounterUndo, type CounterUndo } from '../../utils/counterUndo';
import { getActiveCounters } from '../../utils/dashboardElements';
import { idSet } from './idSet';
import type { TodayCounterFacts } from './todayModel';
import type { UndoBar } from './useUndoBar';

/** Marks the bar's entry as a counter's, so a counter action can withdraw it. */
const UNDO_OWNER = 'counters';

export type TodayCounters = {
  /** Every active counter, in the user's order. */
  activeIds: string[];
  facts: TodayCounterFacts[];
  byId: ReadonlyMap<string, ElementDefinition>;
  configs: ReadonlyMap<string, CounterConfig>;
  /** Counters that exist at all, archived included. */
  totalCount: number;
  /** Today's totals have not landed yet. */
  waiting: boolean;
  /** Stable handlers for the memoised cards. */
  onLog: (
    element: ElementDefinition,
    value: number,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  onSetDailyTotal: (element: ElementDefinition, total: number) => Promise<void>;
  onSkipToday: (element: ElementDefinition, config: CounterConfig, skip: boolean) => void;
  onOpenDetails: (element: ElementDefinition) => void;
};

/**
 * The counters half of Today.
 *
 * Reads completion and skips as joined id lists and the run as a number, not
 * the maps: a +1 (or a habit tick, which also writes `dailyTotals`) re-renders
 * the page only when a counter crosses its target and the header would change.
 */
export function useTodayCounters(undoBar: UndoBar): TodayCounters {
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const { t: tTrackers } = useTranslation('trackers');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const elements = useElementStore((s) => s.elements);
  const dashboard = useElementStore((s) => s.dashboard);
  const logEvent = useEventStore((s) => s.logEvent);
  const setDailyTotal = useEventStore((s) => s.setDailyTotal);
  const adjustDailyTotal = useEventStore((s) => s.adjustDailyTotal);
  const setSkipToday = useEventStore((s) => s.setSkipToday);
  const counterTotalsReady = useEventStore((s) => s.counterTotalsReady);

  useRefreshCounterTotalsOnFocus();

  const active = useMemo(() => getActiveCounters(elements, dashboard), [elements, dashboard]);
  const activeIds = useMemo(() => active.map((counter) => counter.id), [active]);
  const byId = useMemo(() => new Map(active.map((counter) => [counter.id, counter])), [active]);
  const configs = useMemo(() => {
    const parsed = new Map<string, CounterConfig>();
    for (const counter of active) parsed.set(counter.id, CounterConfigSchema.parse(counter.config));
    return parsed;
  }, [active]);
  const totalCount = useMemo(
    () => elements.filter((element) => element.kind === 'counter').length,
    [elements],
  );

  const targets = useMemo(
    () =>
      activeIds
        .map((id) => ({ id, target: configs.get(id)?.dailyTarget ?? 0 }))
        .filter((entry) => entry.target > 0),
    [activeIds, configs],
  );
  const completeKey = useEventStore((s) =>
    targets
      .filter(({ id, target }) => (s.dailyTotals[id] ?? 0) >= target)
      .map(({ id }) => id)
      .join('\n'),
  );
  const skippedKey = useEventStore((s) =>
    targets
      .filter(({ id, target }) => isSkippedToday(s, id, (s.dailyTotals[id] ?? 0) >= target))
      .map(({ id }) => id)
      .join('\n'),
  );

  const facts = useMemo(() => {
    const targeted = new Set(targets.map(({ id }) => id));
    const complete = idSet(completeKey);
    const skipped = idSet(skippedKey);
    return activeIds.map((id) => ({
      id,
      hasTarget: targeted.has(id),
      complete: complete.has(id),
      skipped: skipped.has(id),
    }));
  }, [activeIds, targets, completeKey, skippedKey]);

  /** The burst of taps the bar is offering to take back, while it is. */
  const burstRef = useRef<CounterUndo | null>(null);
  // Stable callbacks for the memoised cards; the latest values ride on a ref.
  const latest = useRef({ undoBar, navigation, t, tCommon, tTrackers });
  latest.current = { undoBar, navigation, t, tCommon, tTrackers };

  const onLog = useCallback(
    (element: ElementDefinition, value: number, meta?: Record<string, unknown>) => {
      const before = useEventStore.getState().dailyTotals[element.id] ?? 0;
      return logEvent(element.id, value, meta)
        .then(() => {
          const { undoBar: bar, tTrackers: tT } = latest.current;
          // Taps on one counter add up into one Undo; anything else starts over.
          const burst = nextCounterUndo(burstRef.current, {
            elementId: element.id,
            name: element.name,
            before,
            added: value,
          });
          const close = () => {
            if (burstRef.current === burst) burstRef.current = null;
          };
          bar.offer({
            owner: UNDO_OWNER,
            message: tT('undo.counterAdded', { name: burst.name, count: burst.added }),
            // Take back what the burst added, from what SQLite holds now — not
            // back to the total seen before it, which would erase another
            // writer's entries.
            undo: () => {
              close();
              return adjustDailyTotal(burst.elementId, -burst.added);
            },
            settle: close,
          });
          burstRef.current = burst;
        })
        .catch((error: unknown) => {
          const { t: tHome, tCommon: tC } = latest.current;
          notify({
            title: tC('alerts.couldNotLog'),
            message: error instanceof Error ? error.message : tHome('today.couldNotLogBody'),
          });
        });
    },
    [adjustDailyTotal, logEvent],
  );

  const onSetDailyTotal = useCallback(
    async (element: ElementDefinition, total: number) => {
      await setDailyTotal(element.id, total);
      // An exact total supersedes the taps the pending Undo would take back.
      if (burstRef.current?.elementId === element.id) latest.current.undoBar.settle(UNDO_OWNER);
    },
    [setDailyTotal],
  );

  const onSkipToday = useCallback(
    (element: ElementDefinition, config: CounterConfig, skip: boolean) => {
      const tracker = { kind: 'counter' as const, config };
      setSkipToday(element.id, tracker, skip)
        .then(() => {
          const { undoBar: bar, tTrackers: tT } = latest.current;
          if (!skip) {
            // Un-skipping by hand answers a pending counter Undo; another row's stays.
            bar.settle(UNDO_OWNER);
            return;
          }
          bar.offer({
            owner: UNDO_OWNER,
            message: tT('undo.skipped', { name: element.name }),
            undo: () => setSkipToday(element.id, tracker, false),
          });
        })
        .catch((error: unknown) => {
          const { tCommon: tC, tTrackers: tT } = latest.current;
          notify({
            title: tT('skip.couldNotSkipTitle'),
            message: error instanceof Error ? error.message : tC('errors.somethingWentWrong'),
          });
        });
    },
    [setSkipToday],
  );

  const onOpenDetails = useCallback((element: ElementDefinition) => {
    latest.current.navigation.navigate('TrackerHistory', { elementId: element.id });
  }, []);

  // Wait for today's totals — a +1 before they land would render against a stale base.
  const waiting = active.length > 0 && !counterTotalsReady;

  return {
    activeIds,
    facts,
    byId,
    configs,
    totalCount,
    waiting,
    onLog,
    onSetDailyTotal,
    onSkipToday,
    onOpenDetails,
  };
}
