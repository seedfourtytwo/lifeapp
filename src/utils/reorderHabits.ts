import type { DashboardItem, ElementDefinition, ElementKind } from '../protocol';

/**
 * Write a new on-screen sequence for visible habits into the global habit order,
 * keeping non-visible habits in their relative places.
 */
export function applyVisibleOrder(
  orderedIds: string[],
  nextVisibleOrder: readonly string[],
): string[] | null {
  const peerSet = new Set(nextVisibleOrder);
  if (peerSet.size !== nextVisibleOrder.length) return null;

  const peerPositions: number[] = [];
  for (let index = 0; index < orderedIds.length; index += 1) {
    if (peerSet.has(orderedIds[index])) {
      peerPositions.push(index);
    }
  }
  if (peerPositions.length !== nextVisibleOrder.length) return null;

  const next = [...orderedIds];
  peerPositions.forEach((position, index) => {
    next[position] = nextVisibleOrder[index];
  });
  return next;
}

/** Move one id from `from` to `to` within a list (drag-and-drop drop target). */
export function moveIdInOrder(
  orderedIds: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] | null {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= orderedIds.length ||
    toIndex >= orderedIds.length ||
    fromIndex === toIndex
  ) {
    return null;
  }
  const next = [...orderedIds];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

/**
 * Merge a new sequence for one element kind into the full dashboard order,
 * keeping other kinds in their relative places.
 */
export function mergeKindOrderIntoDashboard(
  dashboard: DashboardItem[],
  elements: ElementDefinition[],
  kind: ElementKind,
  nextKindOrder: string[],
): { updates: { id: string; sortOrder: number }[]; nextDashboard: DashboardItem[] } {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const byElementId = new Map(dashboard.map((item) => [item.elementId, item]));
  const sorted = [...dashboard].sort((a, b) => a.sortOrder - b.sortOrder);

  const kindQueue = [...nextKindOrder];
  const nextElementOrder: string[] = [];

  for (const item of sorted) {
    const element = byId.get(item.elementId);
    if (!element || element.archivedAt != null) continue;
    if (element.kind === kind) {
      const nextId = kindQueue.shift();
      if (nextId) nextElementOrder.push(nextId);
    } else {
      nextElementOrder.push(element.id);
    }
  }
  nextElementOrder.push(...kindQueue);

  const updates: { id: string; sortOrder: number }[] = [];
  const nextDashboard: DashboardItem[] = [];
  const written = new Set<string>();

  nextElementOrder.forEach((elementId, sortOrder) => {
    const item = byElementId.get(elementId);
    if (!item || written.has(item.id)) return;
    written.add(item.id);
    updates.push({ id: item.id, sortOrder });
    nextDashboard.push({ ...item, sortOrder });
  });

  for (const item of dashboard) {
    if (written.has(item.id)) continue;
    nextDashboard.push(item);
  }

  nextDashboard.sort((a, b) => a.sortOrder - b.sortOrder);
  return { updates, nextDashboard };
}

/** Habit-specific alias. */
export function mergeHabitOrderIntoDashboard(
  dashboard: DashboardItem[],
  elements: ElementDefinition[],
  nextHabitOrder: string[],
) {
  return mergeKindOrderIntoDashboard(dashboard, elements, 'habit', nextHabitOrder);
}
