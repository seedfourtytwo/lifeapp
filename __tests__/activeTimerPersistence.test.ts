import { ActiveTimerSessionSchema } from '../src/protocol';
import { z } from 'zod';

const PersistedSessionsSchema = z.record(ActiveTimerSessionSchema);

describe('active timer persistence schema', () => {
  it('accepts valid session maps', () => {
    const parsed = PersistedSessionsSchema.safeParse({
      'habit-1': {
        startedAt: '2025-01-01T10:00:00.000Z',
        pausedAt: null,
        pauseOffsetMs: 0,
        calendarDate: '2025-01-01',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed sessions', () => {
    const parsed = PersistedSessionsSchema.safeParse({
      'habit-1': {
        startedAt: 'not-a-date',
        pausedAt: null,
        pauseOffsetMs: -1,
        calendarDate: '01-01-2025',
      },
    });
    expect(parsed.success).toBe(false);
  });
});
