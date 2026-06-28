import { toDateString } from '../protocol';

export function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateString(d);
}

export function lastNDates(count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(toDateString(d));
  }
  return dates;
}

export function formatChartLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export function formatFullDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
