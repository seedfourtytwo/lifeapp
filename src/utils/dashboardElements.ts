import {
  isCounterElement,
  isHabitElement,
  type CounterElement,
  type DashboardItem,
  type ElementDefinition,
  type HabitElement,
} from '../protocol';

/**
 * Active elements appear on Home. Invariant: active ⇔ `archivedAt == null`
 * and (normally) a matching `dashboard_items` row for sort order.
 */
export function isElementArchived(element: ElementDefinition): boolean {
  return element.archivedAt != null;
}

function sortActiveElements<T extends ElementDefinition>(
  elements: T[],
  dashboard: DashboardItem[],
): T[] {
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
export function getActiveElements<T extends ElementDefinition>(
  elements: T[],
  dashboard: DashboardItem[],
): T[] {
  return sortActiveElements(
    elements.filter((element) => !isElementArchived(element)),
    dashboard,
  );
}

export function getActiveHabits(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): HabitElement[] {
  return getActiveElements(elements.filter(isHabitElement), dashboard);
}

export function getActiveCounters(
  elements: ElementDefinition[],
  dashboard: DashboardItem[],
): CounterElement[] {
  return getActiveElements(elements.filter(isCounterElement), dashboard);
}
