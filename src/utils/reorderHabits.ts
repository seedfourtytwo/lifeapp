import type { DashboardItem, ElementDefinition, ElementKind } from '../protocol';

/**
 * Move an item up/down within a peer group, keeping non-peers in place
 * among themselves in the global order.
 */
export function movePeersInOrder(
  orderedIds: string[],
  peerIds: readonly string[],
  itemId: string,
  direction: 'up' | 'down',
): string[] | null {
  const peerSet = new Set(peerIds);
  if (!peerSet.has(itemId)) return null;

  const peerPositions: number[] = [];
  for (let index = 0; index < orderedIds.length; index += 1) {
    if (peerSet.has(orderedIds[index])) {
      peerPositions.push(index);
    }
  }

  const peerOrder = peerPositions.map((position) => orderedIds[position]);
  const from = peerOrder.indexOf(itemId);
  if (from < 0) return null;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= peerOrder.length) return null;

  const nextPeerOrder = [...peerOrder];
  [nextPeerOrder[from], nextPeerOrder[to]] = [nextPeerOrder[to], nextPeerOrder[from]];

  const next = [...orderedIds];
  peerPositions.forEach((position, index) => {
    next[position] = nextPeerOrder[index];
  });
  return next;
}

/** Alias used by habit slot reorder call sites/tests. */
export const moveHabitInSlotOrder = movePeersInOrder;

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
