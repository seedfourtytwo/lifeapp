import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../db/client';
import { withGuardedWrite } from '../db/dataGeneration';
import * as elementRepo from '../db/repositories/elementRepository';
import * as urgeRepo from '../db/repositories/urgeRepository';
import {
  DEFAULT_RIDE_SECONDS,
  normalizeUrgeNote,
  ridesEnded,
  rideEndsAt,
  type UrgeOutcome,
  type UrgeSource,
} from '../protocol/urge';
import { getActiveCommitment } from '../utils/dashboardElements';
import { currentAppCalendarDate } from '../utils/dayRollover';
import { newId } from '../utils/id';
import type { ResettableMirror } from './mirrorReset';

/** The ride of the latest open urge. */
export interface UrgeRide {
  urgeId: string;
  startedAt: string;
  endsAt: string;
}

/** An urge logged somewhere else (the widget), keeping its own id, moment and day. */
export interface LoggedUrge {
  id: string;
  at: string;
  day: string;
}

interface UrgeState extends ResettableMirror {
  ride: UrgeRide | null;
  urgesToday: number;
  /** Every urge ever ridden out. Nothing resets it. */
  riddenOutTotal: number;
  loaded: boolean;
  /** Ride out every urge whose ride has ended, then show what SQLite holds. */
  refresh: () => Promise<void>;
  /** One call, no questions. Resolves to the new urge's id, or null when an import/clear discarded it. */
  logUrge: () => Promise<string | null>;
  /** Insert an urge logged elsewhere, once by its id. */
  recordLoggedUrge: (logged: LoggedUrge, source: UrgeSource) => Promise<void>;
  /** Resolve an open urge at `at` (now by default); a resolved one keeps its first outcome. */
  resolveUrge: (id: string, outcome: UrgeOutcome, at?: string) => Promise<void>;
  /** Keep what led to the urge, on one line; empty text keeps nothing. */
  noteUrge: (id: string, text: string) => Promise<void>;
  /** How an urge ended (null while open, or gone); read from SQLite, not mirrored. */
  readOutcome: (id: string) => Promise<UrgeOutcome | null>;
}

type UrgeMirror = Pick<UrgeState, 'ride' | 'urgesToday' | 'riddenOutTotal' | 'loaded'>;

const EMPTY: UrgeMirror = { ride: null, urgesToday: 0, riddenOutTotal: 0, loaded: false };

/** Rides out what has ended and reads the state back, inside the caller's write. */
async function settle(db: SQLiteDatabase, now: Date): Promise<UrgeMirror> {
  // The commitment's ride length; with none (or none any more), ten minutes.
  const commitment = getActiveCommitment(await elementRepo.getAllElements(db));
  const rideSeconds = commitment?.config.rideSeconds ?? DEFAULT_RIDE_SECONDS;
  const open = await urgeRepo.getOpenUrges(db);
  const ended = ridesEnded(open, rideSeconds, now);
  for (const { id, resolvedAt } of ended) {
    await urgeRepo.resolveUrge(db, id, 'rode_out', resolvedAt);
  }
  const endedIds = new Set(ended.map(({ id }) => id));
  const latest = open.filter(({ id }) => !endedIds.has(id)).at(-1);
  return {
    ride: latest
      ? {
          urgeId: latest.id,
          startedAt: latest.at,
          endsAt: rideEndsAt(latest, rideSeconds).toISOString(),
        }
      : null,
    urgesToday: await urgeRepo.countUrgesOnDay(db, currentAppCalendarDate(now)),
    riddenOutTotal: await urgeRepo.countRiddenOut(db),
    loaded: true,
  };
}

export const useUrgeStore = create<UrgeState>((set) => {
  /** Write, then settle and show, as one guarded write; false when it was discarded. */
  async function writeAndShow(write: (db: SQLiteDatabase, now: Date) => Promise<void>): Promise<boolean> {
    const shown = await withGuardedWrite('protocol', async (guard) => {
      const db = await getDatabase();
      const now = new Date();
      await write(db, now);
      const next = await settle(db, now);
      if (guard.superseded()) return false;
      set(next);
      return true;
    });
    return shown === true;
  }

  return {
    ...EMPTY,

    reset: async () => {
      set(EMPTY);
    },

    refresh: async () => {
      await writeAndShow(async () => undefined);
    },

    logUrge: async () => {
      const id = newId();
      const written = await writeAndShow(async (db, now) => {
        await urgeRepo.insertUrge(db, {
          id,
          at: now.toISOString(),
          day: currentAppCalendarDate(now),
          outcome: null,
          resolvedAt: null,
          source: 'app',
        });
      });
      return written ? id : null;
    },

    recordLoggedUrge: async (logged, source) => {
      await writeAndShow(async (db) => {
        await urgeRepo.insertUrge(db, { ...logged, outcome: null, resolvedAt: null, source });
      });
    },

    resolveUrge: async (id, outcome, at) => {
      await writeAndShow(async (db, now) => {
        await urgeRepo.resolveUrge(db, id, outcome, at ?? now.toISOString());
      });
    },

    noteUrge: async (id, text) => {
      await writeAndShow(async (db) => {
        await urgeRepo.setUrgeNote(db, id, normalizeUrgeNote(text));
      });
    },

    readOutcome: async (id) => urgeRepo.getUrgeOutcome(await getDatabase(), id),
  };
});
