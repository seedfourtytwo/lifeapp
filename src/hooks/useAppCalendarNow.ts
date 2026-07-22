import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { currentAppCalendarDate } from '../utils/dayRollover';

/**
 * A `Date` that advances when the app calendar day changes (foreground + minute tick).
 * Use for “today” note/journal queries without re-rendering every minute.
 */
export function useAppCalendarNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => {
      setNow((prev) => {
        const next = new Date();
        return currentAppCalendarDate(prev) === currentAppCalendarDate(next) ? prev : next;
      });
    };
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return now;
}
