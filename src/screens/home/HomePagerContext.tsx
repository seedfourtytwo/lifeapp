import { createContext, useCallback, useContext } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import type { HomeTab } from './homePager';

export type HomePagerContextValue = {
  /** The page on screen. */
  activeTab: HomeTab;
  /** Send the user to a page, as a dock tap would. */
  goToTab: (tab: HomeTab) => void;
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

/**
 * A way to send the user to a Home page from anywhere. On Home it moves the
 * pager; on a pushed screen it pops back to Home, which reads the page from
 * its route params and moves there.
 */
export function useGoToHomeTab(): (tab: HomeTab) => void {
  const pager = useContext(HomePagerContext);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const goToTab = pager?.goToTab;
  return useCallback(
    (tab: HomeTab) => {
      if (goToTab) goToTab(tab);
      else navigation.popTo('Home', { tab });
    },
    [goToTab, navigation],
  );
}
