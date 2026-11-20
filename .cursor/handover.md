# Handover — Life rework (18 Nov 2026)

For the next session picking this up locally. **Updated 18 Nov, evening: all of this is now merged into `main` (PR #4) and released as 1.7.0 on the phone.** The lines below marked “was” describe what the earlier author believed; read the correction under each.

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
| 5 | Timers and voice from the widget | Timers done and tested on the device; mic/voice not started |
| 6 | App refocus: Today · Journal · More in the dock, Calendar and Review as pages | Done — see `.cursor/app-refocus.md` |

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
- Colours are one fixed dress (`res/values/colors.xml`), the same in light and dark and on every Android version; the app's themes repeat it (`src/theme/themes.ts`, `src/theme/palette.ts`). Only the corner radii come from the system, on API 31+ (`res/values-v31/dimens.xml`).
- Commits 453d5cc … dda0396 (16–17 Nov) were made in a separate session on `aero` with the phone attached. This handover's author did not write or review them; from their messages they add: timer minutes and in-widget timers with sound, cards and section headings, a pinned running habit with a live clock, counter progress, todo due dates and a Done section. **Read those commits before changing the widget**, and check whether the fixture test and `npm test` still pass after them.

## What is verified, and what is not (18 Nov, evening)

Verified on the device (Pixel 9, lock-screen page, dev package):
- Ticking and unticking a habit: the row moves to Done, the header tally appears and goes.
- Starting a widget timer, the pinned card ticking, stopping it: the session row is removed and a `timer_session` event is written with the right start, end and duration.
- The release APK carries all six sounds as `res/raw/assets_sounds_*` and keeps `android:process=":widget"` on all four components.

Not verified by anyone yet:
- **The widget's sound in a release build has never been heard.** Debug loads sounds as module assets; release looks them up as `res/raw/assets_sounds_<lowercased id>`. The resources are confirmed present in the APK, but the prod widget is not placed on any screen, so it cannot be exercised from a laptop. Place it and start a sound-backed timer.
- **The app's "the widget is timing this habit — stop it and continue" alert has never appeared on a screen.** Five unit tests cover it. Seeing it needs the app open.
- Gradle can report a cached test result as a pass. Force it: `./gradlew :life-widget:testDebugUnitTest --rerun` and read the XML under `modules/life-widget/android/build/test-results`. This caught two real rule mismatches once, and a silently skipped fixture test is reported as a pass.

Checks at the merge commit: `npm test` 126 suites / 1633 tests, `tsc`, `lint` clean; `:life-widget:testDebugUnitTest` 37 tests, 0 skipped. CI runs these on every push to `main` and every PR.

## Next up

### Step 6 (done; see `.cursor/app-refocus.md`) — the original briefs were
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
- ~~A GitHub Actions workflow could not be pushed and is not on the remote.~~ **Wrong.**
  `.github/workflows/ci.yml` was in the repo all along and runs lint, type-check, expo-doctor
  and the test suite. What was missing was the `workflow` token scope, which is why pushes
  touching it were rejected; `gh auth refresh -h github.com -s workflow` fixed that. The jobs
  also pinned Node 20, where `node:sqlite` does not exist, so fourteen database suites could
  not load and CI had been red since September — they now take the version from `.nvmrc` (22).
  There is still **no Android compile check** in CI; that part is worth adding.
- The app has a week-old paused timer on "Study" in `active_timer_sessions`, from 11 Nov. It
  is the app's own, not the widget's, which is why the widget row reads "Paused in the app"
  with no buttons. Nothing clears it but finishing or clearing it in the app.

## Build and safety
- Build procedure: `.cursor/rules/android-build-workflow.mdc`.
- **Never install a build signed with another key over the real app** (`com.lifeapp.dashboard`). Android refuses the upgrade, and uninstalling to get around it deletes the on-device database. Test with the dev build (`com.lifeapp.dashboard.dev`).
- All native code must live in `modules/` — `android/` is generated by `expo prebuild`.
