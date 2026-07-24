# Home calendar (ambient)

Same role as weather: reduce app-switching. **Not** a Life Protocol element kind.

## Status

Shipped on main (local-first v1). Calendar tables landed in schema **v10–v11**; current DB is **v14**.

## Goals

- Glance date + upcoming reminders from Home
- In-app create / edit / delete / repeat / remind / browse
- Included in JSON backup / import
- External sync (CalDAV / Proton / Google) — Later

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| v1 scope | Fully working **in-app** calendar; no external sync |
| Backup | Optional `calendar` section on backup JSON (own `schemaVersion`) |
| Home chrome | Weather mood chip; long-press calendar chip when both enabled |
| Recurrence | None, daily, weekly, monthly, yearly |
| Timing | All-day or start/end (default timed duration 1h) |
| Reminders | Presets per event; local notifications |
| Per-occurrence Done | Silences badge / peek / notifications for that instance only |
| Event type UI | Hidden; new events use `general` (schema keeps birthday/appointment for later) |

## Code

- `src/calendar/` — types, RRULE, occurrence expansion
- `src/db/repositories/calendarRepository.ts` — SQLite CRUD
- `src/store/calendarStore.ts` — Zustand mirror; does **not** schedule notifications
- `src/hooks/useCalendarReminderSync.ts` — sole owner of calendar DATE notification sync
- Screens: `CalendarScreen`, `CalendarEventEditorScreen`
- Home: `HomeChromeBubble` + `CalendarPeekSheet`

Occurrence expansion is centralized in the store (`occurrencesInRange`, `attentionOccurrences`). Event + reminder writes are transactional.

## Later

- Partner calendar (second local calendar + colors)
- ICS / CalDAV sync
- Native date/time pickers
- Weekly BYDAY multi-select UI (engine supports BYDAY; editor uses start weekday)
- Event-type picker UI
