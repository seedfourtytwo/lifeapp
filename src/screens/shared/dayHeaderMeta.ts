import { i18n } from '../../i18n';

/**
 * The status line under a Home tab's date, as two halves: how today stands on
 * the left, the longest run going on the right. Two halves rather than one
 * string joined by a dot, so each reads as its own fact at arm's length.
 */
export type DayHeaderMeta = { lead: string; trail: string | null };

function runLabel(bestStreak: number): string | null {
  return bestStreak > 0 ? i18n.t('home:dayHeader.streak', { count: bestStreak }) : null;
}

/** "2 of 6 done" · "13 days in a row". The run is the best one going. */
export function habitHeaderMeta({
  due,
  done,
  bestStreak,
}: {
  due: number;
  done: number;
  bestStreak: number;
}): DayHeaderMeta {
  if (due === 0) return { lead: i18n.t('home:dayHeader.habitsNoneDue'), trail: null };
  return {
    lead: i18n.t('home:dayHeader.habitsDone', { done, total: due }),
    trail: runLabel(bestStreak),
  };
}

/** "2 counters logged" · "4 days in a row". */
export function counterHeaderMeta({
  logged,
  bestStreak,
}: {
  logged: number;
  bestStreak: number;
}): DayHeaderMeta {
  return {
    lead:
      logged === 0
        ? i18n.t('home:dayHeader.countersNone')
        : i18n.t('home:dayHeader.countersLogged', { count: logged }),
    trail: runLabel(bestStreak),
  };
}
