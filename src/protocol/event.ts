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

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
