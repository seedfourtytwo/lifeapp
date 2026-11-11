/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- loaded after the caller's resetModules() */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ElementDefinition } from '../../src/protocol';

/** Chris's real set-up in size and shape: seven habits used daily, two counters. */
export const TRACKERS = {
  meditation: '550e8400-e29b-41d4-a716-446655441001',
  kefir: '550e8400-e29b-41d4-a716-446655441002',
  sprouts: '550e8400-e29b-41d4-a716-446655441003',
  creatine: '550e8400-e29b-41d4-a716-446655441004',
  breathing: '550e8400-e29b-41d4-a716-446655441005',
  mobility: '550e8400-e29b-41d4-a716-446655441006',
  face: '550e8400-e29b-41d4-a716-446655441007',
  water: '550e8400-e29b-41d4-a716-446655441008',
  coffee: '550e8400-e29b-41d4-a716-446655441009',
} as const;

function definitions(): ElementDefinition[] {
  const protocol = require('../../src/protocol') as typeof import('../../src/protocol');
  const habit = (id: string, name: string, config: Record<string, unknown>): ElementDefinition => ({
    id,
    kind: 'habit',
    name,
    config: protocol.HabitConfigSchema.parse(config),
    protocolVersion: protocol.PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
  const counter = (id: string, name: string, config: Record<string, unknown>): ElementDefinition => ({
    id,
    kind: 'counter',
    name,
    config: protocol.CounterConfigSchema.parse(config),
    protocolVersion: protocol.PROTOCOL_VERSION,
    createdAt: '2026-01-01T08:00:00.000Z',
    archivedAt: null,
  });
  return [
    habit(TRACKERS.meditation, 'Meditation', {
      trackingMode: 'timer',
      dailyTargetSeconds: 900,
      icon: 'meditation',
      lockScreenName: 'Sit',
    }),
    habit(TRACKERS.kefir, 'Burp the kefir', { reminderTimes: ['08:00'] }),
    habit(TRACKERS.sprouts, 'Rinse the sprouts', { reminderTimes: ['08:00', '20:00'] }),
    habit(TRACKERS.creatine, 'Creatine', { icon: 'pill' }),
    habit(TRACKERS.breathing, 'Breathing', {
      trackingMode: 'timer',
      dailyTargetSeconds: 300,
      icon: 'lungs',
    }),
    habit(TRACKERS.mobility, 'Mobility', { schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } }),
    habit(TRACKERS.face, 'Face routine', {
      timeRange: { start: '21:00', end: '23:00' },
      remindMinutesBefore: 15,
    }),
    counter(TRACKERS.water, 'Water', { unit: 'glasses', quickIncrements: [1], dailyTarget: 8, icon: 'water' }),
    counter(TRACKERS.coffee, 'Coffee', { unit: 'cups', quickIncrements: [1] }),
  ];
}

/** Insert the trackers on Home in this order. */
export async function seedRealisticTrackers(db: SQLiteDatabase): Promise<ElementDefinition[]> {
  const elementRepo = require('../../src/db/repositories/elementRepository') as typeof import('../../src/db/repositories/elementRepository');
  const elements = definitions();
  for (const [index, element] of elements.entries()) {
    await elementRepo.insertElementWithDashboardItem(db, element, {
      id: `550e8400-e29b-41d4-a716-4466554411${String(index).padStart(2, '0')}`,
      elementId: element.id,
      sortOrder: index,
    });
  }
  return elements;
}
