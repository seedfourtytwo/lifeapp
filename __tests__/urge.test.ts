import { DEFAULT_RIDE_SECONDS, UrgeSchema, ridesEnded, rideEndsAt, type Urge } from '../src/protocol/urge';

function urge(at: string, overrides: Partial<Urge> = {}): Urge {
  return UrgeSchema.parse({
    id: '550e8400-e29b-41d4-a716-446655443001',
    at,
    day: at.slice(0, 10),
    outcome: null,
    resolvedAt: null,
    source: 'app',
    ...overrides,
  });
}

describe('the ride of an urge', () => {
  it('lasts ten minutes by default', () => {
    expect(DEFAULT_RIDE_SECONDS).toBe(600);
    expect(rideEndsAt(urge('2026-03-10T09:00:00.000Z'), DEFAULT_RIDE_SECONDS).toISOString()).toBe(
      '2026-03-10T09:10:00.000Z',
    );
  });

  it('is still running a millisecond before its end', () => {
    const open = urge('2026-03-10T09:00:00.000Z');
    expect(ridesEnded([open], 600, new Date('2026-03-10T09:09:59.999Z'))).toEqual([]);
  });

  it('has ended exactly at its end, and is resolved at that instant', () => {
    const open = urge('2026-03-10T09:00:00.000Z');
    expect(ridesEnded([open], 600, new Date('2026-03-10T09:10:00.000Z'))).toEqual([
      { id: open.id, resolvedAt: '2026-03-10T09:10:00.000Z' },
    ]);
  });

  it('is resolved at its end, not when the app next looked', () => {
    const open = urge('2026-03-10T09:00:00.000Z');
    expect(ridesEnded([open], 600, new Date('2026-03-12T18:00:00.000Z'))).toEqual([
      { id: open.id, resolvedAt: '2026-03-10T09:10:00.000Z' },
    ]);
  });

  it('follows the ride length it is given', () => {
    const open = urge('2026-03-10T09:00:00.000Z');
    expect(ridesEnded([open], 300, new Date('2026-03-10T09:05:00.000Z'))).toHaveLength(1);
    expect(ridesEnded([open], 900, new Date('2026-03-10T09:10:00.000Z'))).toEqual([]);
  });

  it('leaves an urge alone that is already resolved', () => {
    const used = urge('2026-03-10T09:00:00.000Z', {
      outcome: 'used',
      resolvedAt: '2026-03-10T09:03:00.000Z',
    });
    expect(ridesEnded([used], 600, new Date('2026-03-10T10:00:00.000Z'))).toEqual([]);
  });

  it('keeps running when the clock was moved back before the urge', () => {
    const open = urge('2026-03-10T09:00:00.000Z');
    expect(ridesEnded([open], 600, new Date('2026-03-10T08:00:00.000Z'))).toEqual([]);
  });

  it('rejects an outcome without the moment it was resolved', () => {
    expect(() => urge('2026-03-10T09:00:00.000Z', { outcome: 'rode_out' })).toThrow();
  });
});
