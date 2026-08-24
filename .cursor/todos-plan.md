# Todos

One-off things to get done. **Not** a Life Protocol element kind — its own table, like the
nutrition catalog and the calendar.

## Status

Planned. Branch `claude/todo-feature-1edde7`, off main at `503707e`. DB is at **v20**; todos land in **v21**.

## Boundary rule (locked)

| It… | belongs to |
|-----|-----------|
| repeats, and you count reps over time | **Trackers** (counter) |
| repeats daily, "did I do it" | **Habits** |
| happens at a specific time | **Calendar** |
| needs doing once, then it's gone | **Todos** |

A feature request that breaks this rule belongs in the other feature. No repeats on todos, ever —
that is what makes it a habit.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Storage | Own `todos` table. No element kind, no events, no dashboard pinning |
| Properties | `title`, optional `note`, optional `dueDate` (date-only), `sortOrder`, `createdAt`, `completedAt` |
| Ticking done | Row animates out; 5s Undo snackbar. History is read-only |
| Deleting | Hard delete, gone forever, never in history |
| History | `completed_at IS NOT NULL`, own stack screen, text search + date jump |
| Home placement | 4th dock tab, swipeable, icon `format-list-checks`. This is the last tab that fits |
| Day boundary | `currentAppCalendarDate` (local midnight), same as everything else |
| Day status row | Yes — same `HomeTabDayStatus` as Habits and Counters |
| Sections | Overdue → Today → Later → No date. Headers only when non-empty |
| Reorder | `DraggableTrackerList` per section; `sort_order` is a within-section tiebreaker only |
| Reminders | Finish the dead evening check-in; default on; no settings UI |
| i18n | English only (`fallbackLng: 'en'` covers fr) |

## Schema v21

```sql
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  due_date TEXT,               -- 'YYYY-MM-DD' or NULL
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,           -- NULL = open; set = done, lives in history
  protocol_version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(completed_at);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
```

No foreign keys, no separate history table.

## Code

- `src/protocol/todo.ts` — `TodoSchema`, section/sort logic, `validateBundleTodos`
- `src/db/repositories/todoRepository.ts` — all SQL
- `src/db/schemaIntegrity.ts` — `ensureTodoSchema`, called from v21 and the steady-state pass
- `src/store/todoStore.ts` — Zustand mirror
- `src/screens/TodosScreen.tsx` — pager page; add-field, sections, day status row
- `src/screens/TodoHistoryScreen.tsx` — stack screen; search + date jump
- `src/i18n/locales/en/todos.json`

Follows the nutrition wiring exactly: optional `todos` key on the backup bundle, plus
`export.ts`, `resetAppData.ts`, `reloadStoresAfterImport.ts`.

## Evening check-in (pre-existing dead code)

`scheduleEndOfDayReminder` and `countUnfinishedTrackersToday` are fully built, tested, and
**never called** — no hook, no scheduling, no settings UI, `eveningCheckInEnabled` defaults false.
Todos finish it: a sync hook modelled on `useCalendarReminderSync`, permission request, reschedule
on todo edits and day rollover, default on.

This switches the evening notification on for **habits and counters too** — it has been silent
until now. That behaviour change ships with todos.

Undated todos never notify.

## Later

- Priority, tags, projects — only when a real todo makes you want one
- Un-completing from the history screen (v1 relies on the Undo snackbar)
- Notification settings UI (v1 has no way to silence it short of an OS-level block)
