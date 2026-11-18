# Handover — Life rework (18 Nov 2026)

For the next session picking this up locally. Branch: `claude/focused-sagan-ykt3du` (pushed; `main` untouched, no PR opened).

## Goal the owner set

Turn the prototype into a clean final product for building and tracking habits. Most daily control moves to the home-screen widget; the app mirrors it and otherwise focuses on review, statistics, data and settings. Low friction, forgiving, nothing decorative. Device: GrapheneOS, sideloaded.

Owner's answers that shaped the plan:
- Frictions: opening the app, forgetting, motivation fading after a miss.
- Widget should do: tick habits, counter +/-, start/stop timers, todos.
- Misses: forgiving (skip days, consistency over strict streaks).
- Journal with quick voice notes matters. Calendar matters. Weather is nice-to-have. Nutrition moves under More (owner confirmed).
- Design must match the rest of the phone. No ornament. Explicitly never again: an illustrated background ("the road in the middle"), which an earlier AI pass had added.
- Dispatch work to cheaper models where the task allows; the lead session reviews and designs.

## The six-step plan and where each stands

| # | Step | State |
|---|------|-------|
| 1 | Foundation fixes | Done, committed |
| 2 | Reminders with Done / Snooze / Skip buttons | Not started |
| 3 | Native Today widget | Done and since extended (see below) |
| 4 | Forgiving motivation | Done, committed |
| 5 | Timers and voice from the widget | Timers appear done in later commits; mic/voice not started |
| 6 | App refocus: Today · Journal · Calendar · Review · More | Not started — both workers died on a usage limit before writing anything |

### Step 1 — commits 041669e, dbc656a, 6055b38
- `daysBetween` is a calendar-day difference (every-N-days no longer drifts across a clock change).
- Streaks no longer cap at 365 loop turns; the fetch widens only for a run unbroken at the window edge.
- Per-habit start reminders fire (`src/hooks/useHabitReminderSync.ts`, mounted in `App.tsx`). They were built but never called. Queue is 14 days ahead, topped up on foreground — so they stop if the app is unopened for two weeks. Step 2's native work can remove that limit.
- Two-writer safety: `withImmediateTransaction` (`src/db/immediateTransaction.ts`), `applyHabitDayIntent` applies the intent the screen showed, counter undo is relative, `busy_timeout` on every open, `refreshTodayFromDb()` on foreground gated by `PRAGMA data_version`.
- A tick re-renders one card (per-id selectors, memoised cards).

### Step 4 — commit d52e229
- Skip: event `value` 0, `meta {"source":"skip"}`. A skipped day behaves like an unscheduled day.
- Schedule `{ type: 'times_per_week', times: 1..6 }`, Monday–Sunday; streak counts weeks.
- Strength score 0–100, Loop Habit Tracker's smoothing: `multiplier = 0.5^(sqrt(frequency)/13)`. Shown on history and on the card when the streak is broken.
- Rules are pure functions (`src/protocol/dayRules.ts`, `src/utils/strengthScore.ts`).
- **Contract with the widget:** `__tests__/fixtures/dayRules.json` — the Kotlin unit test runs the same cases.

### Step 3 — commit 2c06f52, then ten commits made in a session on the owner's computer
- `modules/life-widget`: RemoteViews `AppWidgetProvider` + `RemoteViewsService`, no JavaScript on the tap path.
- **Runs in its own process (`android:process=":widget"`). Keep it that way:** expo-sqlite bundles its own SQLite, and the framework's SQLite opening the same file in the same process breaks file locks and can corrupt the database.
- Colours, corners and font come from the system (Material You) palette on API 31+; the app palette is the fallback.
- Commits 453d5cc … dda0396 (16–17 Nov) were made in a separate session on `aero` with the phone attached. This handover's author did not write or review them; from their messages they add: timer minutes and in-widget timers with sound, cards and section headings, a pinned running habit with a live clock, counter progress, todo due dates and a Done section. **Read those commits before changing the widget**, and check whether the fixture test and `npm test` still pass after them.

## What is not verified
- This author never saw the widget on a device. Anything in the first widget commit is compile- and unit-tested only. The later commits were presumably tested on the phone by the session that made them.
- Checks last run by this author at d52e229: `npm test` 124 suites / 1622 tests, `tsc`, `lint` all clean. Not re-run on the current head.
- Gradle can report a cached test result as a pass. Force it: `./gradlew :life-widget:testDebugUnitTest --rerun` and read the XML under `modules/life-widget/android/build/test-results`. This caught two real rule mismatches once.

## Next up

### Step 6 (not started) — the briefs were
**Home pager becomes Today · Journal · Calendar · Review · More.**
- Today = one list: habits and counters in one user order, then a quiet "Todos" label and open todos, then settled (done/skipped) habits. Same structure and order as the widget; if `dashboard_items.sort_order` is per kind, make it one sequence and update the widget's order to match.
- Journal and Calendar become pages (lazy-mount; all pages mount at startup today). Review hosts the redesigned Insights screen. More keeps Trackers, Todo history, Nutrition + Ingredients, Settings.
- Migrate the stored last tab. Delete the dead shells and strings (EN + FR).

**Review replaces Insights** — answers "how am I doing, what needs attention":
- Range: Week · Month · Year. Headline completion rate (done scheduled days / scheduled days; skipped and unscheduled excluded) with one plain comparison sentence.
- A "slipped most" line only when true (lowest completion among habits with ≥3 scheduled days, omitted when all ≥80%).
- One tile per tracker: name, strength score, strip of day cells. Cell states not by colour alone: done = filled, missed = empty ring, skipped = dot, unscheduled = nothing.
- Tracker history: strength, current/best streak, year heatmap (53×7), 90-day strength line.
- Not building: best time of day, correlations (noise at this scale).
- One Svg per strip/heatmap, aggregate GROUP BY reads, pure functions with tests.

### Step 2
Notification actions handled by a native receiver in the `:widget` process (same write rules as the widget), inexact alarms, reschedule on boot, cancel a reminder once the day is done.

### Step 5 remainder
Mic button on the widget that dictates into today's journal (on-device Moonshine). Widgets cannot take text input, so it needs a small sheet over the home screen.

## Known loose ends
- `eventStore.ts` is still a god-file (timer state machine, persistence, haptics, totals, streaks). Core event writes use `withDbWriteLock` + hand-rolled epochs, not `withGuardedWrite`; a migration is one `withEventWrite(elementId, body)` wrapper and about seven call sites.
- Timer persistence writes outside the write lock.
- Widget follows the phone's language and dark mode, not the app's own settings.
- Midnight / time-window widget refresh uses an inexact alarm (up to ~10 min late).
- A GitHub Actions Android compile-check workflow was written but could not be pushed (the GitHub app lacks the Workflows permission). It lived only in the cloud container and is not on the remote. Regenerate it if wanted.

## Build and safety
- Build procedure: `.cursor/rules/android-build-workflow.mdc`.
- **Never install a build signed with another key over the real app** (`com.lifeapp.dashboard`). Android refuses the upgrade, and uninstalling to get around it deletes the on-device database. Test with the dev build (`com.lifeapp.dashboard.dev`).
- All native code must live in `modules/` — `android/` is generated by `expo prebuild`.
