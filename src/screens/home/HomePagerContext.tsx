import { createContext, useContext } from 'react';

export type HomePagerContextValue = {
  /**
   * Hold the pager still while something inside a page owns a sideways drag —
   * a row of chips that scrolls. Android gives a horizontal gesture to the
   * outer scroller, so the inner one has to ask.
   */
  setSwipeLocked: (locked: boolean) => void;
};

/** Provided by HomeScreen; `null` on a pushed screen, which has no pager. */
export const HomePagerContext = createContext<HomePagerContextValue | null>(null);

/** The pager a page sits in, or `null` when rendered outside Home. */
export function useHomePager(): HomePagerContextValue | null {
  return useContext(HomePagerContext);
}
