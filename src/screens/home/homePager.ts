import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * What Home's horizontal pager is made of, kept out of the screen so the parts
 * with edge cases — the offset→page mapping and the back button — can be
 * tested without a renderer. See `__tests__/homePager.test.ts`.
 *
 * More is the fifth page rather than a pushed stack screen: `gestureEnabled`
 * on native-stack is iOS-only, so a pushed More could be entered by tap and
 * left only by the system back button. As a page it inherits the swipe the
 * other four already have, in both directions.
 */
export const HOME_TAB_ORDER = ['habits', 'counters', 'nutrition', 'todos', 'more'] as const;

export type HomeTab = (typeof HOME_TAB_ORDER)[number];

/** The page a left-to-right swipe out of More lands on. */
const PAGE_BEFORE_MORE: HomeTab = HOME_TAB_ORDER[HOME_TAB_ORDER.length - 2];

export type DockIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type DockLabelKey =
  | 'dock.habitsTab'
  | 'dock.countersTab'
  | 'dock.nutritionTab'
  | 'dock.todosTab'
  | 'dock.more';

export type HomeDockItem = {
  value: HomeTab;
  /** Key in the `home` namespace. */
  labelKey: DockLabelKey;
  icon: DockIconName;
};

/** The bottom dock, one item per page and in page order. */
export const HOME_DOCK_ITEMS: readonly HomeDockItem[] = [
  { value: 'habits', labelKey: 'dock.habitsTab', icon: 'calendar-check' },
  { value: 'counters', labelKey: 'dock.countersTab', icon: 'counter' },
  { value: 'nutrition', labelKey: 'dock.nutritionTab', icon: 'silverware-fork-knife' },
  { value: 'todos', labelKey: 'dock.todosTab', icon: 'format-list-checks' },
  { value: 'more', labelKey: 'dock.more', icon: 'dots-horizontal' },
];

/** Where a page sits in the pager, in page widths from the left. */
export function homeTabIndex(tab: HomeTab): number {
  return HOME_TAB_ORDER.indexOf(tab);
}

/**
 * The page a scroll offset belongs to. Clamps rather than trusting the
 * arithmetic: a fling overscrolls past either end, and the first layout can
 * report a page width of 0.
 */
export function homeTabAtOffset(offsetX: number, pageWidth: number): HomeTab {
  const index = Math.round(offsetX / Math.max(pageWidth, 1));
  const clamped = Math.min(Math.max(index, 0), HOME_TAB_ORDER.length - 1);
  return HOME_TAB_ORDER[clamped] ?? 'habits';
}

/**
 * Where the Android back button should go, or `null` to leave the press to the
 * navigator (which exits the app from Home).
 *
 * Only More answers. Back used to pop More off the stack and land on whichever
 * page you left from, so it still does; the four content pages behave exactly
 * as they did before More joined the pager.
 */
export function homeBackTarget(tab: HomeTab, openedFrom: HomeTab): HomeTab | null {
  if (tab !== 'more') return null;
  return openedFrom === 'more' ? PAGE_BEFORE_MORE : openedFrom;
}
