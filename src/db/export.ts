import { createProtocolBundle, parseProtocolBundle } from '../protocol';
import type { ProtocolBundle } from '../protocol';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { readAppSettings, writeAppSettings } from './appSettingsBackup';
import { clearDataForImport } from './resetAppData';
import { normalizeProtocolBundleInput } from './normalizeProtocolBundle';

export async function exportProtocolBundle(): Promise<ProtocolBundle> {
  const db = await getDatabase();
  const [elements, dashboard, events, settings] = await Promise.all([
    elementRepo.getAllElements(db),
    dashboardRepo.getDashboardItems(db),
    eventRepo.getAllEvents(db),
    readAppSettings(db),
  ]);

  return createProtocolBundle({
    elements,
    dashboard,
    events,
    settings,
  });
}

export async function importProtocolBundle(raw: unknown): Promise<void> {
  const normalized = normalizeProtocolBundleInput(raw);
  const bundle = parseProtocolBundle(normalized);
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await clearDataForImport(db);

    for (const element of bundle.elements) {
      await elementRepo.insertElement(db, element);
    }
    for (const item of bundle.dashboard) {
      await dashboardRepo.insertDashboardItem(db, item);
    }
    for (const event of bundle.events) {
      await eventRepo.insertEvent(db, event);
    }
    await writeAppSettings(db, bundle.settings);
  });
}

export function serializeBundle(bundle: ProtocolBundle): string {
  return JSON.stringify(bundle, null, 2);
}
