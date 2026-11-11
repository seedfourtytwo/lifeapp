import { z } from 'zod';
import { derivedId } from '../src/utils/id';

const ACTION = '6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11';

describe('an id derived from another', () => {
  it('is the same every time for the same parts, so a second apply finds its rows', () => {
    expect(derivedId(ACTION, '2026-03-10', 'session')).toBe(derivedId(ACTION, '2026-03-10', 'session'));
  });

  it('differs by day and by role, and from the action id itself', () => {
    const ids = new Set([
      ACTION,
      derivedId(ACTION, '2026-03-10', 'session'),
      derivedId(ACTION, '2026-03-11', 'session'),
      derivedId(ACTION, '2026-03-10', 'mark'),
      derivedId('6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c12', '2026-03-10', 'session'),
    ]);
    expect(ids.size).toBe(5);
  });

  it('is a valid event id', () => {
    expect(z.string().uuid().safeParse(derivedId(ACTION, '2026-03-10', 'session')).success).toBe(true);
  });

  it('does not run parts together: ("ab", "c") is not ("a", "bc")', () => {
    expect(derivedId('ab', 'c')).not.toBe(derivedId('a', 'bc'));
  });
});
