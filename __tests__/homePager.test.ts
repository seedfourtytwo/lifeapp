/**
 * Home's horizontal pager: Today · Journal · Calendar · Review · More.
 *
 * The pages are places, not slices of one day, and only Today mounts at
 * startup. The parts with edge cases are pure functions, pinned here:
 *
 *  - the offset→page mapping, including the overscroll either end where a
 *    fling lands outside the content;
 *  - which pages are mounted: a page is built the first time it is visited, or
 *    when a drag towards it begins, and is never torn down again;
 *  - back: every page steps back to Today, Today exits, and More returns to
 *    the page it was opened from — without that it would fall through to the
 *    navigator and quietly exit the app;
 *  - the stored last page, which may still name a page from the old pager.
 */
import {
  HOME_DOCK_ITEMS,
  HOME_TAB_ORDER,
  homeBackTarget,
  homePagesAfterDragStart,
  homePagesAfterVisit,
  homeStartTab,
  homeTabAtOffset,
  homeTabIndex,
  type HomeTab,
} from '../src/screens/home/homePager';

const PAGE = 400;

function pages(...tabs: HomeTab[]): ReadonlySet<HomeTab> {
  return new Set(tabs);
}

describe('page order', () => {
  it('is Today, Journal, Calendar, Review, More', () => {
    expect([...HOME_TAB_ORDER]).toEqual(['today', 'journal', 'calendar', 'review', 'more']);
  });

  it('puts More last, so a right-to-left swipe from Review enters it', () => {
    expect(homeTabIndex('more')).toBe(homeTabIndex('review') + 1);
  });

  it('starts on Today', () => {
    expect(homeTabIndex('today')).toBe(0);
  });

  it('offers every page in the dock, in page order', () => {
    // A page with no dock item is unreachable by tap; a dock item with no page
    // scrolls to an index that does not exist.
    expect(HOME_DOCK_ITEMS.map((item) => item.value)).toEqual([...HOME_TAB_ORDER]);
  });
});

describe('which page an offset lands on', () => {
  it('maps each page start to its own page', () => {
    expect(homeTabAtOffset(0, PAGE)).toBe('today');
    expect(homeTabAtOffset(PAGE, PAGE)).toBe('journal');
    expect(homeTabAtOffset(2 * PAGE, PAGE)).toBe('calendar');
    expect(homeTabAtOffset(3 * PAGE, PAGE)).toBe('review');
    expect(homeTabAtOffset(4 * PAGE, PAGE)).toBe('more');
  });

  it('rounds to the nearest page when momentum stops between two', () => {
    expect(homeTabAtOffset(3.4 * PAGE, PAGE)).toBe('review');
    expect(homeTabAtOffset(3.6 * PAGE, PAGE)).toBe('more');
  });

  it('clamps overscroll past either end', () => {
    expect(homeTabAtOffset(-120, PAGE)).toBe('today');
    expect(homeTabAtOffset(9 * PAGE, PAGE)).toBe('more');
  });

  it('survives a zero or unmeasured page width', () => {
    // First layout: width can still be 0, and dividing by it must not produce
    // an out-of-range index (or NaN) that blanks the pager.
    expect(homeTabAtOffset(0, 0)).toBe('today');
    expect(homeTabAtOffset(Number.NaN, PAGE)).toBe('today');
  });
});

describe('which pages are mounted', () => {
  it('mounts a page the first time it is visited', () => {
    expect([...homePagesAfterVisit(pages('today'), 'review')].sort()).toEqual([
      'review',
      'today',
    ]);
  });

  it('does not mount the pages a dock tap scrolls past', () => {
    const mounted = homePagesAfterVisit(pages('today'), 'more');
    expect(mounted.has('journal')).toBe(false);
    expect(mounted.has('calendar')).toBe(false);
    expect(mounted.has('review')).toBe(false);
  });

  it('mounts both neighbours when a drag begins', () => {
    // The finger can go either way, and the page has to be there before it shows.
    expect([...homePagesAfterDragStart(pages('today', 'calendar'), 'calendar')].sort()).toEqual([
      'calendar',
      'journal',
      'review',
      'today',
    ]);
  });

  it('mounts only the one neighbour an end page has', () => {
    expect([...homePagesAfterDragStart(pages('today'), 'today')].sort()).toEqual([
      'journal',
      'today',
    ]);
    expect([...homePagesAfterDragStart(pages('today', 'more'), 'more')].sort()).toEqual([
      'more',
      'review',
      'today',
    ]);
  });

  it('never unmounts a page', () => {
    const before = pages('today', 'journal', 'more');
    expect(homePagesAfterVisit(before, 'calendar').has('journal')).toBe(true);
    expect(homePagesAfterDragStart(before, 'today').has('more')).toBe(true);
  });

  it('hands back the same set when nothing new mounts, so React can skip the render', () => {
    const mounted = pages('today', 'journal');
    expect(homePagesAfterVisit(mounted, 'journal')).toBe(mounted);
    expect(homePagesAfterDragStart(mounted, 'today')).toBe(mounted);
  });
});

describe('the Android back button on Home', () => {
  it('exits from Today, the first page', () => {
    expect(homeBackTarget('today', 'today')).toBeNull();
  });

  it('goes to Today from the other content pages instead of leaving the app', () => {
    // Opening on the last-used page means back can no longer mean "exit" on
    // every page: one press from the Journal would close the app mid-thought.
    for (const tab of ['journal', 'calendar', 'review'] as const) {
      expect(homeBackTarget(tab, 'today')).toBe('today');
    }
  });

  it('returns from More to the page it was opened from', () => {
    expect(homeBackTarget('more', 'journal')).toBe('journal');
    expect(homeBackTarget('more', 'today')).toBe('today');
    expect(homeBackTarget('more', 'review')).toBe('review');
  });

  it('falls back to the page beside More if nothing was recorded', () => {
    // Never answer "go to More" while already on More, which would swallow
    // the press and trap the user on the page.
    expect(homeBackTarget('more', 'more')).toBe('review');
  });
});

describe('the page Home opens on', () => {
  it('reopens the content page used last', () => {
    expect(homeStartTab('journal')).toBe('journal');
    expect(homeStartTab('calendar')).toBe('calendar');
    expect(homeStartTab('review')).toBe('review');
  });

  it('never reopens on More, which is a place you pass through', () => {
    expect(homeStartTab('more')).toBe('today');
  });

  it('opens on Today for a page of the old pager, which Today now holds', () => {
    for (const stored of ['habits', 'counters', 'todos', 'nutrition']) {
      expect(homeStartTab(stored)).toBe('today');
    }
  });

  it('starts on Today when nothing or nonsense was stored', () => {
    expect(homeStartTab(null)).toBe('today');
    expect(homeStartTab('')).toBe('today');
    expect(homeStartTab('insights')).toBe('today');
  });
});
