import type { RegisteredKindHandler } from './types';
import { counterHandler } from './counter/handler';
import { habitHandler } from './habit/handler';

export { counterHandler, habitHandler };

const handlers = new Map<string, RegisteredKindHandler>([
  ['counter', counterHandler as unknown as RegisteredKindHandler],
  ['habit', habitHandler as unknown as RegisteredKindHandler],
]);

export function getKindHandler(kind: string): RegisteredKindHandler | undefined {
  return handlers.get(kind);
}
