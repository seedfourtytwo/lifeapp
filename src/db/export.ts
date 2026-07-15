import { createProtocolBundle, parseProtocolBundle } from '../protocol';
import type { ProtocolBundle } from '../protocol';
import { getDatabase } from '../db/client';
import * as elementRepo from '../db/repositories/elementRepository';
import * as dashboardRepo from '../db/repositories/dashboardRepository';
import * as eventRepo from '../db/repositories/eventRepository';
import { readAppSettings, writeAppSettings } from './appSettingsBackup';
import { clearDataForImport } from './resetAppData';
import { normalizeProtocolBundleInput } from './normalizeProtocolBundle';
import { newId } from '../utils/id';

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
    dashboard: dashboard.filter((item) => {
      const element = elements.find((candidate) => candidate.id === item.elementId);
      return element != null && element.archivedAt == null;
    }),
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

    const activeElementIds = new Set(
      bundle.elements
        .filter((element) => element.archivedAt == null)
        .map((element) => element.id),
    );
    const placedElementIds = new Set<string>();
    let sortOrder = 0;
    for (const item of bundle.dashboard) {
      if (!activeElementIds.has(item.elementId)) continue;
      await dashboardRepo.insertDashboardItem(db, item);
      placedElementIds.add(item.elementId);
      sortOrder = Math.max(sortOrder, item.sortOrder + 1);
    }
    for (const element of bundle.elements) {
      if (element.archivedAt != null || placedElementIds.has(element.id)) continue;
      await dashboardRepo.insertDashboardItem(db, {
        id: newId(),
        elementId: element.id,
        sortOrder,
      });
      sortOrder += 1;
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
