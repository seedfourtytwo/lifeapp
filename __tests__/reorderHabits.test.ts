import { PROTOCOL_VERSION, type DashboardItem, type ElementDefinition } from '../src/protocol';
import {
  applyVisibleOrder,
  mergeHabitOrderIntoDashboard,
  mergeKindOrderIntoDashboard,
  moveIdInOrder,
} from '../src/utils/reorderHabits';

describe('moveIdInOrder', () => {
  it('moves an id to a new index', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveIdInOrder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns null for no-ops and out-of-range indexes', () => {
    expect(moveIdInOrder(['a', 'b'], 0, 0)).toBeNull();
    expect(moveIdInOrder(['a', 'b'], -1, 1)).toBeNull();
    expect(moveIdInOrder(['a', 'b'], 0, 5)).toBeNull();
  });
});

describe('applyVisibleOrder', () => {
  it('rewrites visible peer slots and leaves hidden ids in place', () => {
    expect(applyVisibleOrder(['a', 'hidden', 'b', 'c'], ['b', 'a', 'c'])).toEqual([
      'b',
      'hidden',
      'a',
      'c',
    ]);
  });

  it('returns null when visible ids are missing or duplicated', () => {
    expect(applyVisibleOrder(['a', 'b'], ['a', 'a'])).toBeNull();
    expect(applyVisibleOrder(['a', 'b'], ['a', 'x'])).toBeNull();
  });

  it('supports incomplete-only peers like the Habits tab (done parked elsewhere)', () => {
    // Global habit order still includes done "d"; visible incomplete peers reorder among themselves.
    expect(applyVisibleOrder(['a', 'd', 'b', 'c'], ['b', 'a', 'c'])).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });
});

describe('mergeKindOrderIntoDashboard', () => {
  const element = (
    id: string,
    kind: 'habit' | 'counter',
  ): ElementDefinition => ({
    id,
    name: id,
    kind,
    config: {},
    protocolVersion: PROTOCOL_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  const dash = (elementId: string, sortOrder: number): DashboardItem => ({
    id: `d-${elementId}`,
    elementId,
    sortOrder,
  });

  it('rewrites habit order while keeping counters in place', () => {
    const elements = [
      element('h1', 'habit'),
      element('c1', 'counter'),
      element('h2', 'habit'),
    ];
    const dashboard = [dash('h1', 0), dash('c1', 1), dash('h2', 2)];
    const { nextDashboard } = mergeKindOrderIntoDashboard(
      dashboard,
      elements,
      'habit',
      ['h2', 'h1'],
    );
    expect(nextDashboard.map((item) => item.elementId)).toEqual(['h2', 'c1', 'h1']);
  });

  it('rewrites counter order while keeping habits in place', () => {
    const elements = [
      element('h1', 'habit'),
      element('c1', 'counter'),
      element('c2', 'counter'),
    ];
    const dashboard = [dash('h1', 0), dash('c1', 1), dash('c2', 2)];
    const { nextDashboard } = mergeHabitOrderIntoDashboard(
      dashboard,
      elements,
      ['h1'],
    );
    expect(nextDashboard.map((item) => item.elementId)).toEqual(['h1', 'c1', 'c2']);

    const counterMerge = mergeKindOrderIntoDashboard(
      dashboard,
      elements,
      'counter',
      ['c2', 'c1'],
    );
    expect(counterMerge.nextDashboard.map((item) => item.elementId)).toEqual([
      'h1',
      'c2',
      'c1',
    ]);
  });
});
