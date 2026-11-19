import { getDateLocale } from '../../i18n';
import { parseLocalDate } from '../../protocol/event';

/**
 * A day as a journal writes it above an entry: "Tuesday 17 November", with
 * the year only once it is not this one.
 */
export function formatJournalDay(date: string, today: string): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return parseLocalDate(date).toLocaleDateString(getDateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
