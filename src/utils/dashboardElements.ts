import type { DashboardItem, ElementDefinition } from '../protocol';

/**
 * Active elements appear on Home. Invariant: active ⇔ `archivedAt == null`
 * and (normally) a matching `dashboard_items` row for sort order.
 */
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

export function getActiveCounters(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): ElementDefinition[] {
  return getActiveElements(
    elements.filter((element) => element.kind === 'counter'),
    dashboard,
  );
}
