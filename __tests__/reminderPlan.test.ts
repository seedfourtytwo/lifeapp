import { buildReminderPlan } from '../src/notifications/reminderPlan';
import { ReminderPlanSchema } from '../src/protocol/reminderPlan';
import { counterElement, habitElement } from './support/elements';

const KEFIR = '550e8400-e29b-41d4-a716-446655440981';
const SIT = '550e8400-e29b-41d4-a716-446655440982';
const WATER = '550e8400-e29b-41d4-a716-446655440983';

const kefir = habitElement({
  id: KEFIR,
  name: 'Burp the kefir',
  config: { reminderTimes: ['20:00', '09:00'], schedule: { type: 'weekdays', days: [1, 3] } },
});
const sit = habitElement({
  id: SIT,
  name: 'Meditation',
  config: {
    trackingMode: 'timer',
    lockScreenName: 'Sit',
    timeRange: { start: '07:00', end: '08:00' },
    remindMinutesBefore: 15,
  },
});

it('carries each habit that reminds: its times, schedule and both names', () => {
  const plan = buildReminderPlan({ elements: [kefir, sit], enabled: true, language: 'fr' });

  expect(ReminderPlanSchema.parse(plan)).toEqual({
    version: 1,
    enabled: true,
    language: 'fr',
    habits: [
      {
        id: KEFIR,
        name: 'Burp the kefir',
        lockScreenName: null,
        schedule: { type: 'weekdays', days: [1, 3] },
        reminderTimes: ['09:00', '20:00'],
      },
      {
        id: SIT,
        name: 'Meditation',
        lockScreenName: 'Sit',
        schedule: { type: 'daily' },
        // The reminder before the time window counts like any other.
        reminderTimes: ['06:45'],
      },
    ],
  });
});

it('leaves out archived habits, habits that never remind, and counters', () => {
  const plan = buildReminderPlan({
    elements: [
      habitElement({ id: KEFIR, config: { reminderTimes: ['09:00'] }, archivedAt: '2026-11-01T08:00:00.000Z' }),
      habitElement({ id: SIT }),
      counterElement({ id: WATER }),
    ],
    enabled: true,
    language: 'en',
  });

  expect(plan.habits).toEqual([]);
});

it('says when reminders are off, and still names the language for the timer', () => {
  const plan = buildReminderPlan({ elements: [kefir], enabled: false, language: 'en' });

  expect(plan.enabled).toBe(false);
  expect(plan.language).toBe('en');
});
