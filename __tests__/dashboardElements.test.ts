import type { DashboardItem, ElementDefinition } from '../src/protocol';
import { PROTOCOL_VERSION } from '../src/protocol';
import {
  getActiveElements,
  getActiveHabits,
  isElementArchived,
} from '../src/utils/dashboardElements';

const element = (
  id: string,
  kind: 'counter' | 'habit' = 'counter',
  archivedAt: string | null = null,
): ElementDefinition => ({
  id,
  kind,
  name: id,
  config: {},
  protocolVersion: PROTOCOL_VERSION,
  createdAt: '2025-01-01T00:00:00.000Z',
  archivedAt,
});

const dashboardItem = (elementId: string, sortOrder: number): DashboardItem => ({
  id: `dash-${elementId}`,
  elementId,
  sortOrder,
});

describe('isElementArchived', () => {
  it('returns true when archivedAt is set', () => {
    expect(isElementArchived(element('a', 'counter', '2025-01-02T00:00:00.000Z'))).toBe(true);
  });

  it('returns false when archivedAt is null', () => {
    expect(isElementArchived(element('a'))).toBe(false);
  });
});

describe('getActiveElements', () => {
  it('returns only non-archived elements in dashboard order', () => {
    const elements = [
      element('a'),
      element('b'),
      element('c', 'habit'),
      element('d', 'counter', '2025-01-02T00:00:00.000Z'),
    ];
    const dashboard = [dashboardItem('c', 0), dashboardItem('a', 1)];

    expect(getActiveElements(elements, dashboard).map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns empty when everything is archived', () => {
    const elements = [
      element('a', 'counter', '2025-01-02T00:00:00.000Z'),
      element('b', 'habit', '2025-01-02T00:00:00.000Z'),
    ];
    expect(getActiveElements(elements, [dashboardItem('a', 0)])).toEqual([]);
  });
});

describe('getActiveHabits', () => {
  it('filters to active habits only', () => {
    const elements = [element('a'), element('b', 'habit'), element('c', 'habit')];
    const dashboard = [dashboardItem('b', 0), dashboardItem('a', 1)];

    expect(getActiveHabits(elements, dashboard).map((item) => item.id)).toEqual(['b', 'c']);
  });
});
