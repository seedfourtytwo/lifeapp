import type { DashboardItem, ElementDefinition } from '../protocol';

/**
 * Move a habit up/down within its time-slot peer group inside the global habit order.
 * Non-slot habits (or other slots) keep their relative positions among themselves.
 */
export function moveHabitInSlotOrder(
  orderedHabitIds: string[],
  slotHabitIds: readonly string[],
  habitId: string,
  direction: 'up' | 'down',
): string[] | null {
  const slotSet = new Set(slotHabitIds);
  if (!slotSet.has(habitId)) return null;

  const slotPositions: number[] = [];
  for (let index = 0; index < orderedHabitIds.length; index += 1) {
    if (slotSet.has(orderedHabitIds[index])) {
      slotPositions.push(index);
    }
  }

  const slotOrder = slotPositions.map((position) => orderedHabitIds[position]);
  const from = slotOrder.indexOf(habitId);
  if (from < 0) return null;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= slotOrder.length) return null;

  const nextSlotOrder = [...slotOrder];
  [nextSlotOrder[from], nextSlotOrder[to]] = [nextSlotOrder[to], nextSlotOrder[from]];

  const next = [...orderedHabitIds];
  slotPositions.forEach((position, index) => {
    next[position] = nextSlotOrder[index];
  });
  return next;
}

/**
 * Merge a new habit sequence into the full dashboard order, keeping counters
 * (and other non-habits) in their relative places.
 */
export function mergeHabitOrderIntoDashboard(
  dashboard: DashboardItem[],
  elements: ElementDefinition[],
  nextHabitOrder: string[],
): { updates: { id: string; sortOrder: number }[]; nextDashboard: DashboardItem[] } {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const byElementId = new Map(dashboard.map((item) => [item.elementId, item]));
  const sorted = [...dashboard].sort((a, b) => a.sortOrder - b.sortOrder);

  const habitQueue = [...nextHabitOrder];
  const nextElementOrder: string[] = [];

  for (const item of sorted) {
    const element = byId.get(item.elementId);
    if (!element || element.archivedAt != null) continue;
    if (element.kind === 'habit') {
      const nextHabitId = habitQueue.shift();
      if (nextHabitId) nextElementOrder.push(nextHabitId);
    } else {
      nextElementOrder.push(element.id);
    }
  }
  nextElementOrder.push(...habitQueue);

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
