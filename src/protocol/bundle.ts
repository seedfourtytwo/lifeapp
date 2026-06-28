import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';
import { ElementDefinitionSchema } from './element';
import { EventSchema } from './event';

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
});

export type ProtocolBundle = z.infer<typeof ProtocolBundleSchema>;

export function parseProtocolBundle(raw: unknown): ProtocolBundle {
  return ProtocolBundleSchema.parse(raw);
}
