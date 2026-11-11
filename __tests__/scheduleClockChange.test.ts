/**
 * "Every N days" counts calendar days between local midnights. Across the
 * spring clock change that span is an hour short of whole days, and flooring
 * it made the habit come due a day late. Run in Chris's zone, where the
 * clocks went forward on 29 March 2026.
 */
import { daysBetween, isScheduleActiveOnDate } from '../src/protocol/schedule';

const previousTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});

afterAll(() => {
  process.env.TZ = previousTz;
});

it('runs in a zone with a spring-forward night', () => {
  expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-60);
  expect(new Date(2026, 2, 30, 12).getTimezoneOffset()).toBe(-120);
});

it('counts the clock-change night as a whole day', () => {
  expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
});

it('brings an every-2-days habit due on time across the change', () => {
  const schedule = { type: 'every_n_days' as const, interval: 2, anchorDate: '2026-03-28' };
  expect(isScheduleActiveOnDate(schedule, '2026-03-29')).toBe(false);
  expect(isScheduleActiveOnDate(schedule, '2026-03-30')).toBe(true);
  expect(isScheduleActiveOnDate(schedule, '2026-03-31')).toBe(false);
});
