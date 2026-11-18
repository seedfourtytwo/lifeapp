import { readFileSync } from 'fs';
import { join } from 'path';
import { habitReminderSignature } from '../src/hooks/useHabitReminderSync';
import type { ElementDefinition, HabitConfig } from '../src/protocol';

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

function habit(overrides: Partial<HabitConfig> = {}, id = 'h1', name = 'Meditate'): ElementDefinition {
  return {
    id,
    kind: 'habit',
    name,
    protocolVersion: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    config: {
      timeSlot: 'morning',
      trackingMode: 'boolean',
      schedule: { type: 'daily' },
      timeRange: { start: '07:00', end: '08:00' },
      remindMinutesBefore: 10,
      ...overrides,
    },
  };
}

describe('habit reminder sync is reachable from the app', () => {
  it('mounts useHabitReminderSync at the app root', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/import \{ useHabitReminderSync \} from '\.\/src\/hooks\/useHabitReminderSync'/);
    expect(app).toMatch(/^\s*useHabitReminderSync\(\);/m);
  });

  it('the hook calls syncHabitReminders and listens to foreground + both stores', () => {
    const hook = read('src/hooks/useHabitReminderSync.ts');
    expect(hook).toMatch(/syncHabitReminders\(/);
    expect(hook).toMatch(/AppState\.addEventListener/);
    expect(hook).toMatch(/useElementStore\.subscribe/);
    expect(hook).toMatch(/useEventStore\.subscribe/);
  });
});

describe('habitReminderSignature', () => {
  const sig = (els: ElementDefinition[], done: Record<string, boolean> = {}, day = '2025-01-15') =>
    habitReminderSignature(els, done, day, 'en');

  it('is stable when nothing reminder-relevant changed', () => {
    const base = sig([habit()]);
    expect(sig([habit()])).toBe(base);
    // A counter and an unrelated habit do not matter.
    expect(sig([habit(), habit({ remindMinutesBefore: undefined }, 'h2')])).toBe(base);
  });

  it('changes when the habit, its done state, or the day changes', () => {
    const base = sig([habit()]);
    expect(sig([habit({ remindMinutesBefore: 5 })])).not.toBe(base);
    expect(sig([habit({ timeRange: { start: '09:00', end: '10:00' } })])).not.toBe(base);
    expect(sig([habit({}, 'h1', 'Read')])).not.toBe(base);
    expect(sig([habit()], { h1: true })).not.toBe(base);
    expect(sig([habit()], {}, '2025-01-16')).not.toBe(base);
    expect(sig([])).not.toBe(base);
  });

  it('ignores archived habits', () => {
    const archived: ElementDefinition = { ...habit(), archivedAt: '2025-06-01T00:00:00.000Z' };
    expect(sig([archived])).toBe(sig([]));
  });
});
