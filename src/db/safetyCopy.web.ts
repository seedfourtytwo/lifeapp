import type { SQLiteDatabase } from 'expo-sqlite';
import type { SafetyCopyReason } from './safetyCopy';

/**
 * The browser build keeps its database in OPFS, where expo-sqlite cannot open
 * a second file by directory. Web is a secondary target with no data worth a
 * copy, so it takes none rather than failing every upgrade.
 */
export async function takeSafetyCopy(_db: SQLiteDatabase, _reason: SafetyCopyReason): Promise<void> {}
