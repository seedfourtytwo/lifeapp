/**
 * What Home's horizontal pager is made of, kept out of the screen so the parts
 * with edge cases — the offset→page mapping, which pages are mounted, the back
 * button and the stored last page — can be tested without a renderer. See
 * `__tests__/homePager.test.ts`.
 *
 * Every page has a word in the dock, in this order. Calendar and Review are
 * not pages: they are pushed on the stack, from the day header and from More.
 *
 * More is the last page rather than a pushed stack screen: `gestureEnabled`
 * on native-stack is iOS-only, so a pushed More could be entered by tap and
 * left only by the system back button. As a page it inherits the swipe the
 * others have, in both directions.
 */
export const HOME_TAB_ORDER = ['today', 'journal', 'more'] as const;

export type HomeTab = (typeof HOME_TAB_ORDER)[number];

/**
 * What Home hands a page that has to know when it is the one on screen.
 * Native-stack focus events do not fire on a pager swipe, so a page that
 * refreshes on arrival watches this instead.
 */
export type HomePageProps = {
  active: boolean;
};

/** The page a left-to-right swipe out of More lands on. */
const PAGE_BEFORE_MORE: HomeTab = HOME_TAB_ORDER[HOME_TAB_ORDER.length - 2];

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
  return HOME_TAB_ORDER[clamped] ?? HOME_TAB_ORDER[0];
}

/** The pages Home builds at startup: Today only. The rest wait to be wanted. */
export const HOME_PAGES_AT_START: ReadonlySet<HomeTab> = new Set([HOME_TAB_ORDER[0]]);

/** `mounted` plus `wanted` — the same set back when it already holds them all. */
function withPages(mounted: ReadonlySet<HomeTab>, wanted: readonly HomeTab[]): ReadonlySet<HomeTab> {
  const missing = wanted.filter((tab) => !mounted.has(tab));
  return missing.length === 0 ? mounted : new Set([...mounted, ...missing]);
}

/**
 * The mounted pages once `tab` has been visited — by a dock tap or a swipe
 * coming to rest. Pages scrolled past on the way are
 * not built. A mounted page is never dropped.
 */
export function homePagesAfterVisit(
  mounted: ReadonlySet<HomeTab>,
  tab: HomeTab,
): ReadonlySet<HomeTab> {
  return withPages(mounted, [tab]);
}

/**
 * The mounted pages once a horizontal drag has begun on `current`. The finger
 * can go either way, so both neighbours are built before either can show.
 */
export function homePagesAfterDragStart(
  mounted: ReadonlySet<HomeTab>,
  current: HomeTab,
): ReadonlySet<HomeTab> {
  const index = homeTabIndex(current);
  const neighbours = [HOME_TAB_ORDER[index - 1], HOME_TAB_ORDER[index + 1]].filter(
    (tab): tab is HomeTab => tab != null,
  );
  return withPages(mounted, [current, ...neighbours]);
}

/**
 * Where the Android back button should go, or `null` to leave the press to the
 * navigator (which exits the app from Home).
 *
 * Home reopens on the last page used, so back cannot simply exit everywhere:
 * the Journal steps back to Today first, and only Today exits.
 * More returns to the page it was opened from, as popping the stack used to.
 */
export function homeBackTarget(tab: HomeTab, openedFrom: HomeTab): HomeTab | null {
  if (tab === 'more') return openedFrom === 'more' ? PAGE_BEFORE_MORE : openedFrom;
  return tab === HOME_TAB_ORDER[0] ? null : HOME_TAB_ORDER[0];
}

/**
 * The page Home opens on, from what was stored last time. More is a place you
 * pass through, so it is never reopened. Anything else that is not a page
 * starts on Today — which covers nonsense and also what earlier pagers
 * stored: `habits`, `counters`, `todos` and `nutrition`, which Today now holds
 * or has taken the place of, and `calendar` and `review`, which are pushed
 * screens now.
 */
export function homeStartTab(stored: string | null): HomeTab {
  const tab = HOME_TAB_ORDER.find((candidate) => candidate === stored);
  return tab && tab !== 'more' ? tab : HOME_TAB_ORDER[0];
}
