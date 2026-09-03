/**
 * Home's horizontal pager, now that More is a page of it rather than a screen
 * pushed on the stack.
 *
 * The push had no way back by swipe: `gestureEnabled` on native-stack is iOS
 * only, so on Android More was the one part of Home you could reach by tap and
 * leave only by the system back button. Making it the fifth page buys both
 * directions from the pager that already carries the other four.
 *
 * Two things stop being free once that happens, and both live here:
 *
 *  - the offset→page mapping has to cover five pages, including the overscroll
 *    either end where a fling lands outside the content;
 *  - back has to mean something on the More page. It used to pop the stack and
 *    land on whichever tab you left, so it still does — without that it would
 *    fall through to the navigator and quietly exit the app.
 */
import {
  HOME_DOCK_ITEMS,
  HOME_TAB_ORDER,
  homeBackTarget,
  homeTabAtOffset,
  homeTabIndex,
} from '../src/screens/home/homePager';

const PAGE = 400;

describe('page order', () => {
  it('puts More last, so a right-to-left swipe from Todos enters it', () => {
    expect(HOME_TAB_ORDER[HOME_TAB_ORDER.length - 1]).toBe('more');
    expect(homeTabIndex('more')).toBe(homeTabIndex('todos') + 1);
  });

  it('starts on Habits', () => {
    expect(homeTabIndex('habits')).toBe(0);
  });

  it('offers every page in the dock, in page order', () => {
    // A page with no dock item is unreachable by tap; a dock item with no page
    // scrolls to an index that does not exist.
    expect(HOME_DOCK_ITEMS.map((item) => item.value)).toEqual([...HOME_TAB_ORDER]);
  });
});

describe('which page an offset lands on', () => {
  it('maps each page start to its own page', () => {
    expect(homeTabAtOffset(0, PAGE)).toBe('habits');
    expect(homeTabAtOffset(PAGE, PAGE)).toBe('counters');
    expect(homeTabAtOffset(2 * PAGE, PAGE)).toBe('nutrition');
    expect(homeTabAtOffset(3 * PAGE, PAGE)).toBe('todos');
    expect(homeTabAtOffset(4 * PAGE, PAGE)).toBe('more');
  });

  it('rounds to the nearest page when momentum stops between two', () => {
    expect(homeTabAtOffset(3.4 * PAGE, PAGE)).toBe('todos');
    expect(homeTabAtOffset(3.6 * PAGE, PAGE)).toBe('more');
  });

  it('clamps overscroll past either end', () => {
    expect(homeTabAtOffset(-120, PAGE)).toBe('habits');
    expect(homeTabAtOffset(9 * PAGE, PAGE)).toBe('more');
  });

  it('survives a zero or unmeasured page width', () => {
    // First layout: width can still be 0, and dividing by it must not produce
    // an out-of-range index (or NaN) that blanks the pager.
    expect(homeTabAtOffset(0, 0)).toBe('habits');
    expect(homeTabAtOffset(Number.NaN, PAGE)).toBe('habits');
  });
});

describe('the Android back button on Home', () => {
  it('leaves the four content pages to the navigator', () => {
    // Unchanged from before More became a page: back on a content page is not
    // ours to intercept — it exits the app, as the system expects.
    for (const tab of ['habits', 'counters', 'nutrition', 'todos'] as const) {
      expect(homeBackTarget(tab, 'habits')).toBeNull();
    }
  });

  it('returns from More to the page it was opened from', () => {
    // The dock reaches More from any page, and popping the stack used to land
    // back on that page. Keep that: back is "undo the trip to More".
    expect(homeBackTarget('more', 'counters')).toBe('counters');
    expect(homeBackTarget('more', 'habits')).toBe('habits');
    expect(homeBackTarget('more', 'todos')).toBe('todos');
  });

  it('falls back to the page beside More if nothing was recorded', () => {
    // Defensive: never answer "go to More" while already on More, which would
    // swallow the press and trap the user on the page.
    const beside = HOME_TAB_ORDER[HOME_TAB_ORDER.length - 2];
    expect(homeBackTarget('more', 'more')).toBe(beside);
  });
});
