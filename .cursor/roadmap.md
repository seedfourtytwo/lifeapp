# Roadmap

Active plan for Life Dashboard. Intent only — do not scaffold protocol, DB, or UI until a chunk is in progress.

**North star:** phone-first Android, local SQLite, Habits + Counters as equals, Life Protocol kinds only when UX diverges, ambient features outside protocol, EN+FR together, ship small chunks.

**Native builds:** local Android SDK by default (`dev` + Metro; `prod` release APK for standalone). See `.cursor/rules/android-build-workflow.mdc`.

---

## Shipped (main)

| Area | Notes |
|------|--------|
| Habits / Counters | Check-off, timers, +/undo, drag-reorder, streaks (habit + counter target-hit) |
| Trackers | Create / edit / archive / delete; curated icons + identity marks on Home |
| Notes / journals | Per-tracker day notes + daily journals; mic dictation (on-device ASI only) |
| Calendar | Local events, recurrence, reminders, Home peek (ambient) |
| Weather | Home mood chip, forecast strip, fling physics (ambient); coarse location |
| Data | Full JSON backup; granular Clear data… |
| Privacy | No accounts/cloud; `allowBackup=false`; no Google speech / network dictation |
| i18n | EN + FR |

App **1.3.1** · DB schema **v14** · Protocol **v1**.

---

## Next

Ordered for day-to-day work. Skip or reorder when a bug blocks use.

| # | Item | Notes |
|---|------|--------|
| 1 | **T2c** Tracker editor / settings menus | Clearer sections; less clutter. Worktree may exist: `feature/habit-editor-polish` |
| 2 | **T2e** Sheet transitions + journal expand | Smooth open; journal vs notes IA |
| 3 | **T2f** Haptics / chime taste | After layouts settle |
| 4 | **Session Lock** | One media-session for habit timers; no duplicate lock-screen controls. Then decide lock-screen dictation/Done. Worktree: `feature/lock-screen-media-controls` |
| 5 | **Session Export** | Granular export/import by type (+ optional date range); plain journal/notes share as a preset |

### Smaller leftovers

- Counter hold-+5/+10
- Counter target-hit streak in History / Insights (Home cache is not stats)
- Insights content redesign (not just chrome)
- Note undo/redo
- Voice “Done” / formatting keywords (after Echo — Echo is shipped)
- Mixed FR/EN dictation policy
- Calendar: event-type UI, weekly BYDAY multi-select, native pickers
- Competitor pick (one session): skip day, heatmap, EMA, widgets — not mixed into UI polish

---

## Session briefs

### Session Export

Settings flow for export/import by data type (same spirit as Clear data…), optional date range, formats as needed (JSON backup + plain text/markdown for notes). Merge vs replace rules on import. Not Proton/cloud.

### Session Lock

Diagnose media-session / lock-screen ownership → single session start/pause/done + unlock sync → then decide lock-screen dictation / habit Done.

---

## Parking lot

Vague or distant ideas live in [product-ideas.md](./product-ideas.md). Calendar Later list: [calendar-plan.md](./calendar-plan.md).

Do not start: idea inbox, to-dos, food, quotes, Proton backup, home widgets, CalDAV, new protocol kinds — until intentionally scheduled.
