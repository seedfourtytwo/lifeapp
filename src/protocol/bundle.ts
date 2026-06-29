import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { ElementDefinitionSchema } from './element';
import { EventSchema } from './event';
import { SoundAssetSchema } from './sound';
import { validateBundleEventLinks } from './eventMeta';
import type { ElementDefinition } from './element';
import type { LifeEvent } from './event';

export const DashboardItemSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
  sortOrder: z.number().int(),
  overrides: z.record(z.unknown()).optional(),
});

export type DashboardItem = z.infer<typeof DashboardItemSchema>;

export const ProtocolBundleSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  exportedAt: z.string().datetime(),
  elements: z.array(ElementDefinitionSchema),
  dashboard: z.array(DashboardItemSchema),
  events: z.array(EventSchema),
  /** Optional sound tracks referenced by habit configs (`soundId`). */
  soundLibrary: z.array(SoundAssetSchema).optional(),
});

export type ProtocolBundle = z.infer<typeof ProtocolBundleSchema>;

export function parseProtocolBundle(raw: unknown): ProtocolBundle {
  const bundle = ProtocolBundleSchema.parse(raw);
  validateBundleEventLinks(bundle.elements, bundle.events);
  return bundle;
}

export function createProtocolBundle(input: {
  elements: ElementDefinition[];
  dashboard: z.infer<typeof DashboardItemSchema>[];
  events: LifeEvent[];
  soundLibrary?: z.infer<typeof SoundAssetSchema>[];
}): ProtocolBundle {
  const bundle: ProtocolBundle = {
    protocolVersion: PROTOCOL_VERSION,
    exportedAt: new Date().toISOString(),
    elements: input.elements,
    dashboard: input.dashboard,
    events: input.events,
    ...(input.soundLibrary && input.soundLibrary.length > 0
      ? { soundLibrary: input.soundLibrary }
      : {}),
  };
  validateBundleEventLinks(bundle.elements, bundle.events);
  return bundle;
}
