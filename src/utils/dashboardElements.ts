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

export function getPinnedHabits(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  return getPinnedElements(
    elements.filter((element) => element.kind === 'habit'),
    dashboard,
  );
}

/** Stable key for pinned habit identity — avoids redundant bootstrap when unrelated fields change. */
export function pinnedHabitIdsKey(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): string {
  return getPinnedHabits(elements, dashboard)
    .map((habit) => habit.id)
    .sort()
    .join('|');
}
