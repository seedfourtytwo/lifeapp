import type { DashboardItem, ElementDefinition } from '../protocol';

/** Elements pinned to Home, ordered by dashboard sort_order. */
export function getPinnedElements(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  const order = new Map(dashboard.map((item, index) => [item.elementId, index]));
  return elements
    .filter((element) => order.has(element.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
