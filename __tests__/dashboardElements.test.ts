import type { DashboardItem, ElementDefinition } from '../src/protocol';
import { PROTOCOL_VERSION } from '../src/protocol';
import { getPinnedElements, getPinnedHabits, pinnedHabitIdsKey } from '../src/utils/dashboardElements';

const element = (id: string, kind: 'counter' | 'habit' = 'counter'): ElementDefinition => ({
  id,
  kind,
  name: id,
  config: {},
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
});

const dashboardItem = (elementId: string, sortOrder: number): DashboardItem => ({
  id: `dash-${elementId}`,
  elementId,
  sortOrder,
});

describe('getPinnedElements', () => {
  it('returns only pinned elements in dashboard order', () => {
    const elements = [element('a'), element('b'), element('c', 'habit')];
    const dashboard = [dashboardItem('c', 0), dashboardItem('a', 1)];

    expect(getPinnedElements(elements, dashboard).map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('returns empty when nothing is pinned', () => {
    const elements = [element('a'), element('b', 'habit')];
    expect(getPinnedElements(elements, [])).toEqual([]);
  });
});

describe('getPinnedHabits', () => {
  it('filters to pinned habits only', () => {
    const elements = [element('a'), element('b', 'habit'), element('c', 'habit')];
    const dashboard = [dashboardItem('b', 0), dashboardItem('a', 1)];

    expect(getPinnedHabits(elements, dashboard).map((item) => item.id)).toEqual(['b']);
  });
});

describe('pinnedHabitIdsKey', () => {
  it('is stable regardless of habit order in elements list', () => {
    const elements = [element('b', 'habit'), element('a', 'habit')];
    const dashboard = [dashboardItem('a', 0), dashboardItem('b', 1)];

    expect(pinnedHabitIdsKey(elements, dashboard)).toBe('a|b');
  });
});
