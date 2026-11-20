import { getDatabase } from '../../db/client';
import { withGuardedWrite } from '../../db/dataGeneration';
import * as settingsRepo from '../../db/repositories/settingsRepository';
import { APP_SETTING_KEYS } from '../../protocol/appSettings';
import { homeStartTab, type HomeTab } from './homePager';

/** The page Home should open on. Any failure just means Today. */
export async function loadHomeStartTab(): Promise<HomeTab> {
  try {
    const db = await getDatabase();
    return homeStartTab(await settingsRepo.getSetting(db, APP_SETTING_KEYS.homeLastTab));
  } catch {
    return homeStartTab(null);
  }
}

/** Remember the page in use. Best effort: losing it only costs a swipe next launch. */
export function saveHomeTab(tab: HomeTab): void {
  void withGuardedWrite('protocol', async (guard) => {
    const db = await getDatabase();
    if (guard.superseded()) return;
    await settingsRepo.setSetting(db, APP_SETTING_KEYS.homeLastTab, tab);
  }).catch(() => undefined);
}
