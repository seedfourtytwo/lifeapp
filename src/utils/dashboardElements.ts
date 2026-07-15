import type { DashboardItem, ElementDefinition } from '../protocol';

export function isElementArchived(element: ElementDefinition): boolean {
  return element.archivedAt != null;
}

function sortActiveElements(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  const order = new Map(dashboard.map((item, index) => [item.elementId, index]));
  return [...elements].sort((a, b) => {
    const aOrder = order.get(a.id);
    const bOrder = order.get(b.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Non-archived elements shown on Home, ordered by dashboard sort_order. */
export function getActiveElements(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  return sortActiveElements(
    elements.filter((element) => !isElementArchived(element)),
    dashboard,
  );
}

export function getActiveHabits(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  return getActiveElements(
    elements.filter((element) => element.kind === 'habit'),
    dashboard,
  );
}

/** Stable key for active habit identity — avoids redundant bootstrap when unrelated fields change. */
export function activeHabitIdsKey(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): string {
  return getActiveHabits(elements, dashboard)
    .map((habit) => habit.id)
    .sort()
    .join('|');
}
