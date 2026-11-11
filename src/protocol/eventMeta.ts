import type { ElementDefinition, ElementKind } from './element';
import { HabitEventMetaSchema } from './kinds/habit';
import { CounterEventMetaSchema } from './kinds/counter';
import type { LifeEvent } from './event';

export function parseEventMeta(
  kind: ElementKind,
  meta: unknown,
): ReturnType<typeof CounterEventMetaSchema.parse> | ReturnType<typeof HabitEventMetaSchema.parse> {
  if (kind === 'counter') {
    return CounterEventMetaSchema.parse(meta);
  }
  if (kind === 'habit') {
    return HabitEventMetaSchema.parse(meta);
  }
  throw new Error(`No event meta schema for kind: ${kind}`);
}

export function validateEventForElement(
  element: ElementDefinition,
  event: LifeEvent,
): void {
  if (event.elementId !== element.id) {
    throw new Error(`Event ${event.id} does not belong to element ${element.id}`);
  }

  if (event.meta !== undefined) {
    parseEventMeta(element.kind, event.meta);
  }

  if (event.value < 0) {
    throw new Error(`Event ${event.id} has negative value`);
  }
}

export function validateBundleEventLinks(
  elements: ElementDefinition[],
  events: LifeEvent[],
): void {
  const byId = new Map(elements.map((element) => [element.id, element]));

  for (const event of events) {
    const element = byId.get(event.elementId);
    if (!element) {
      throw new Error(`Event ${event.id} references unknown element ${event.elementId}`);
    }
    validateEventForElement(element, event);
  }
}
