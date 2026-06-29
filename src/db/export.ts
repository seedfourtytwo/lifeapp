import { createProtocolBundle, parseProtocolBundle } from '../protocol';
import type { ProtocolBundle } from '../protocol';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import * as soundLibraryRepo from '../db/repositories/soundLibraryRepository';

export async function exportProtocolBundle(): Promise<ProtocolBundle> {
  const db = await getDatabase();
  const [elements, dashboard, events, soundLibrary] = await Promise.all([
    elementRepo.getAllElements(db),
    dashboardRepo.getDashboardItems(db),
    eventRepo.getAllEvents(db),
    soundLibraryRepo.getSoundLibrary(db),
  ]);

  return createProtocolBundle({
    elements,
    dashboard,
    events,
    soundLibrary,
  });
}

export async function importProtocolBundle(raw: unknown): Promise<void> {
  const bundle = parseProtocolBundle(raw);
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM events');
    await db.runAsync('DELETE FROM dashboard_items');
    await db.runAsync('DELETE FROM elements');

    for (const element of bundle.elements) {
      await elementRepo.insertElement(db, element);
    }
    for (const item of bundle.dashboard) {
      await dashboardRepo.insertDashboardItem(db, item);
    }
    for (const event of bundle.events) {
      await eventRepo.insertEvent(db, event);
    }

    if (bundle.soundLibrary) {
      await soundLibraryRepo.setSoundLibrary(db, bundle.soundLibrary);
    }
  });
}

export function serializeBundle(bundle: ProtocolBundle): string {
  return JSON.stringify(bundle, null, 2);
}
