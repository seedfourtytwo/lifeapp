import { PROTOCOL_VERSION, type DashboardItem, type ElementDefinition } from '../src/protocol';
import {
  mergeHabitOrderIntoDashboard,
  mergeKindOrderIntoDashboard,
  moveHabitInSlotOrder,
  movePeersInOrder,
} from '../src/utils/reorderHabits';

describe('movePeersInOrder', () => {
  it('moves a habit up within its slot peers', () => {
    const ordered = ['m1', 'a1', 'm2', 'e1', 'm3'];
    const morning = ['m1', 'm2', 'm3'];
    expect(movePeersInOrder(ordered, morning, 'm2', 'up')).toEqual([
      'm2',
      'a1',
      'm1',
      'e1',
      'm3',
    ]);
  });

  it('moves a habit down within its slot peers', () => {
    const ordered = ['m1', 'a1', 'm2'];
    const morning = ['m1', 'm2'];
    expect(moveHabitInSlotOrder(ordered, morning, 'm1', 'down')).toEqual([
      'm2',
      'a1',
      'm1',
    ]);
  });

  it('returns null at the ends or for foreign habit', () => {
    const ordered = ['m1', 'm2'];
    const morning = ['m1', 'm2'];
    expect(movePeersInOrder(ordered, morning, 'm1', 'up')).toBeNull();
    expect(movePeersInOrder(ordered, morning, 'm2', 'down')).toBeNull();
    expect(movePeersInOrder(ordered, morning, 'x', 'up')).toBeNull();
  });
});

describe('mergeKindOrderIntoDashboard', () => {
  const element = (
    id: string,
    kind: 'habit' | 'counter',
  ): ElementDefinition => ({
    id,
    kind,
    name: id,
    config: kind === 'habit' ? { timeSlot: 'anytime', schedule: { type: 'daily' } } : { step: 1 },
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2025-01-01T00:00:00.000Z',
  });

  const dash = (elementId: string, sortOrder: number): DashboardItem => ({
    id: `d-${elementId}`,
    elementId,
    sortOrder,
  });

  it('rewrites habit order while keeping counters in place', () => {
    const elements = [element('c1', 'counter'), element('h1', 'habit'), element('h2', 'habit')];
    const dashboard = [dash('c1', 0), dash('h1', 1), dash('h2', 2)];
    const { nextDashboard, updates } = mergeHabitOrderIntoDashboard(dashboard, elements, [
      'h2',
      'h1',
    ]);

    expect(updates.map((u) => u.id)).toEqual(['d-c1', 'd-h2', 'd-h1']);
    expect(nextDashboard.map((item) => item.elementId)).toEqual(['c1', 'h2', 'h1']);
    expect(nextDashboard.map((item) => item.sortOrder)).toEqual([0, 1, 2]);
  });

  it('rewrites counter order while keeping habits in place', () => {
    const elements = [element('h1', 'habit'), element('c1', 'counter'), element('c2', 'counter')];
    const dashboard = [dash('h1', 0), dash('c1', 1), dash('c2', 2)];
    const { nextDashboard } = mergeKindOrderIntoDashboard(dashboard, elements, 'counter', [
      'c2',
      'c1',
    ]);
    expect(nextDashboard.map((item) => item.elementId)).toEqual(['h1', 'c2', 'c1']);
  });
});
