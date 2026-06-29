import type { DashboardItem, ElementDefinition } from '../src/protocol';
import { PROTOCOL_VERSION } from '../src/protocol';
import { getPinnedElements } from '../src/utils/dashboardElements';

const element = (id: string, kind: 'counter' | 'habit' = 'counter'): ElementDefinition => ({
  id,
  kind,
  name: id,
  category: kind === 'counter' ? 'exercise' : 'habit',
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
