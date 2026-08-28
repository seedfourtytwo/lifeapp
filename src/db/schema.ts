import { PERSISTED_CONCEPTS } from './persistedConcepts';

export const DB_NAME = 'lifeapp.db';

/**
 * Lean Life Protocol v1 + ambient tables, assembled from the one declaration
 * of each persisted concept (`persistedConcepts.ts`) rather than a second
 * hand-maintained copy of every CREATE TABLE.
 *
 * Boot-safe: this string runs on every open, including pre-v16 databases, so
 * every statement in it is `IF NOT EXISTS`. Shape repairs that a create cannot
 * express live on the concept, in `schemaRepairs.ts`.
 */
export const SCHEMA_SQL = [
  'PRAGMA journal_mode = WAL;',
  'PRAGMA foreign_keys = ON;',
  ...PERSISTED_CONCEPTS.map((concept) => concept.ddl.trim()),
].join('\n\n');
