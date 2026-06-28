/** Life Protocol envelope — versioned wrapper for all persisted payloads. */

export const PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;

export interface ProtocolEnvelope<T> {
  protocolVersion: ProtocolVersion;
  payload: T;
}

export function wrapPayload<T>(payload: T): ProtocolEnvelope<T> {
  return { protocolVersion: PROTOCOL_VERSION, payload };
}
