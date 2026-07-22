import { PROTOCOL_VERSION } from '../src/protocol';
import { countUnfinishedTrackersToday } from '../src/notifications/unfinishedTrackers';
import type { ElementDefinition } from '../src/protocol';

const habitId = '550e8400-e29b-41d4-a716-446655440010';
const counterId = '550e8400-e29b-41d4-a716-446655440011';
const counterNoTargetId = '550e8400-e29b-41d4-a716-446655440012';

const habit: ElementDefinition = {
  id: habitId,
  kind: 'habit',
  name: 'Meditate',
  config: {
    timeSlot: 'anytime',
    trackingMode: 'boolean',
    schedule: { type: 'daily' },
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

const counterWithTarget: ElementDefinition = {
  id: counterId,
  kind: 'counter',
  name: 'Push-ups',
  config: {
    unit: 'reps',
    quickIncrements: [5, 10],
    dailyTarget: 50,
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

const counterWithoutTarget: ElementDefinition = {
  id: counterNoTargetId,
  kind: 'counter',
  name: 'Steps',
  config: {
    unit: 'steps',
    quickIncrements: [1000],
  },
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt: null,
};

describe('countUnfinishedTrackersToday', () => {
  const now = new Date(2025, 0, 15, 18, 0, 0);

  it('counts undone habits and counters under target', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit, counterWithTarget, counterWithoutTarget],
        habitDoneToday: {},
        dailyTotals: { [counterId]: 20 },
        now,
      }),
    ).toEqual({ habits: 1, counters: 1, total: 2 });
  });

  it('ignores completed habits and met counter targets', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [habit, counterWithTarget],
        habitDoneToday: { [habitId]: true },
        dailyTotals: { [counterId]: 50 },
        now,
      }),
    ).toEqual({ habits: 0, counters: 0, total: 0 });
  });

  it('ignores archived trackers', () => {
    expect(
      countUnfinishedTrackersToday({
        elements: [
          { ...habit, archivedAt: '2025-01-01T00:00:00.000Z' },
          { ...counterWithTarget, archivedAt: '2025-01-01T00:00:00.000Z' },
        ],
        habitDoneToday: {},
        dailyTotals: {},
        now,
      }),
    ).toEqual({ habits: 0, counters: 0, total: 0 });
  });
});
