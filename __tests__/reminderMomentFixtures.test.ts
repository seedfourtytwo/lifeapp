import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HabitSchedule } from '../src/protocol';
import { reminderMomentsOn } from '../src/notifications/habitStartReminderTimes';

/**
 * When a habit reminds on a date: the app uses it for the snapshot's
 * `nextReminders`, the native scheduler for the alarm. `ReminderRulesTest.kt`
 * runs the same file.
 */
interface MomentCase {
  name: string;
  schedule: HabitSchedule;
  reminderTimes: string[];
  date: string;
  moments: string[];
}

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../modules/life-core/fixtures/reminder-moments.json'), 'utf8'),
) as { zone: string; cases: MomentCase[] };

const previousTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = fixture.zone;
});
afterAll(() => {
  process.env.TZ = previousTz;
});

it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
  expect(
    reminderMomentsOn(c.schedule, c.reminderTimes, c.date).map((moment) => moment.toISOString()),
  ).toEqual(c.moments);
});
