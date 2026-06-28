import { z } from 'zod';
import { PROTOCOL_VERSION } from './envelope';

export const EventSchema = z.object({
  id: z.string().uuid(),
  elementId: z.string().uuid(),
  timestamp: z.string().datetime(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number(),
  meta: z.record(z.unknown()).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

export type LifeEvent = z.infer<typeof EventSchema>;

export function parseEvent(raw: unknown): LifeEvent {
  return EventSchema.parse(raw);
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
