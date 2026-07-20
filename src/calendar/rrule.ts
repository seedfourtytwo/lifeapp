import type { RecurrenceFreq, RecurrenceRule, Weekday } from './types';
import { WEEKDAYS } from './types';

const WEEKDAY_SET = new Set<string>(WEEKDAYS);

export function weekdayFromDate(date: Date): Weekday {
  // JS: 0=Sun … 6=Sat → SU…SA
  const js = date.getDay();
  return WEEKDAYS[(js + 6) % 7]!;
}

export function parseRrule(rrule: string | null | undefined): RecurrenceRule {
  if (!rrule || rrule.trim() === '') {
    return { freq: 'none', interval: 1, byWeekDays: [] };
  }

  const parts = Object.fromEntries(
    rrule
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        if (eq < 0) return [part.toUpperCase(), ''];
        return [part.slice(0, eq).toUpperCase(), part.slice(eq + 1)];
      }),
  ) as Record<string, string>;

  const freqRaw = (parts.FREQ ?? '').toUpperCase();
  let freq: RecurrenceFreq = 'none';
  if (freqRaw === 'DAILY') freq = 'daily';
  else if (freqRaw === 'WEEKLY') freq = 'weekly';
  else if (freqRaw === 'MONTHLY') freq = 'monthly';
  else if (freqRaw === 'YEARLY') freq = 'yearly';

  const interval = Math.max(1, Number.parseInt(parts.INTERVAL ?? '1', 10) || 1);

  const byWeekDays: Weekday[] = [];
  if (parts.BYDAY) {
    for (const token of parts.BYDAY.split(',')) {
      const day = token.trim().toUpperCase();
      if (WEEKDAY_SET.has(day)) {
        byWeekDays.push(day as Weekday);
      }
    }
  }

  return { freq, interval, byWeekDays };
}

export function recurrenceToRrule(rule: RecurrenceRule): string | null {
  if (rule.freq === 'none') return null;

  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.freq === 'weekly' && rule.byWeekDays.length > 0) {
    parts.push(`BYDAY=${rule.byWeekDays.join(',')}`);
  }
  return parts.join(';');
}

export function recurrenceLabel(rule: RecurrenceRule): string {
  switch (rule.freq) {
    case 'none':
      return 'Does not repeat';
    case 'daily':
      return rule.interval === 1 ? 'Every day' : `Every ${rule.interval} days`;
    case 'weekly': {
      if (rule.byWeekDays.length === 0) {
        return rule.interval === 1 ? 'Every week' : `Every ${rule.interval} weeks`;
      }
      return `Weekly (${rule.byWeekDays.join(', ')})`;
    }
    case 'monthly':
      return rule.interval === 1 ? 'Every month' : `Every ${rule.interval} months`;
    case 'yearly':
      return rule.interval === 1 ? 'Every year' : `Every ${rule.interval} years`;
  }
}
