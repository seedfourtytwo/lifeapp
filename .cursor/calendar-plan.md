# Home calendar (ambient feature)

Same role as weather: reduce app-switching. **Not** a Life Protocol element kind.

## Status

Implemented on `feature/home-calendar` (local-first v1). DB schema **v11** (includes per-occurrence clears).

## Product goals

- Frictionless day-to-day: glance date + upcoming reminders from Home.
- **Fully working local calendar** (create / edit / delete / repeat / remind / browse).
- Local-first / offline-first.
- Calendar data included in **Export backup / Import backup**.
- External calendar sync (Proton / Gmail / partner CalDAV) is **later**.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| v1 scope | Fully working **in-app** calendar; no external sync yet |
| App backup | Optional `calendar` section on backup JSON (own `schemaVersion`) |
| Home chrome | Combined bubble + Weather/Calendar fan-out chips |
| Recurrence | None, daily, weekly, monthly, yearly |
| Timing | All-day or start/end (default timed duration 1h) |
| Reminders | Customizable presets per event; local notifications |
| Per-occurrence Done | Silences badge / peek / notifications for that instance only |
| Event type UI | Hidden in v1; new events use `general` (schema keeps birthday/appointment for later) |

## Code layout

- `src/calendar/` — types, RRULE, occurrence expansion, format helpers
- `src/db/repositories/calendarRepository.ts` — SQLite CRUD (schema **v11**)
- `src/store/calendarStore.ts` — Zustand mirror; **does not** schedule notifications
- `src/hooks/useCalendarReminderSync.ts` — **sole owner** of calendar DATE notification sync
- `src/notifications/calendarReminders.*` — schedule/cancel (capped; respects clears)
- Screens: `CalendarScreen`, `CalendarEventEditorScreen` (+ `screens/calendar/` sections)
- Home: `HomeChromeBubble` + `CalendarPeekSheet` + `WeatherForecastSheet`

## Architecture notes

- Occurrence expansion is centralized in the store (`occurrencesInRange`, `attentionOccurrences`); UI should call those helpers instead of re-expanding.
- Event + reminders writes are transactional (`insertEventWithReminders` / `updateEventWithReminders`).
- Editor remounts per `eventId` / seed via navigator `getId`.

## Later

- Partner calendar (second local calendar + colors)
- ICS / CalDAV / Google / Proton sync
- Native date/time pickers
- Weekly BYDAY multi-select UI (engine supports BYDAY; editor uses start weekday for weekly)
- Event-type picker UI (when UX needs it)
