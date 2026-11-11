# Clean slate, then the widget

Date: 2026-11-11 · Status: approved by Chris 2026-11-11

## Why

Chris uses Life daily for habits but not for everything he wants. He wants it "in his face": a lock-screen widget page with today's habits, reminders (burp the kefir, rinse the sprouts), a craving button, and the ability to finish a timed habit early. Before building on it he asked for a full review so the new work sits on a sound base.

The review found the base looks good and is well typed, but several things under it are wrong in ways tests don't catch: reminders never fire, a few paths can change or lose data without the user meaning to, and the only backup can break. The widget adds a second writer, which makes each of these worse. So: fix what can hurt data, make reminders real, unify the "is today done" rule, then build the widget.

## Baseline (measured 2026-11-11)

- Local, Node 22.23: `tsc` clean, `eslint` clean, jest 118/118 suites, 1499 tests.
- CI is red only because `.github/workflows/ci.yml` pins Node 20 and 12 suites need `node:sqlite`.
- Phone: Pixel 9, GrapheneOS 2026110701, Android 17 (SDK 37). Release `com.lifeapp.dashboard` 1.6.1 (vc 29). Dev build `com.lifeapp.dashboard.dev` is a stale 1.5.3.
- On the phone, `dumpsys alarm` shows zero alarms for the app and there are no notification channels. No reminder has ever been scheduled.
- Real usage: 7 habits used daily; 2 counters rarely; nutrition never (catalogue empty); 2 todos.

## Goals

1. No path changes or loses data unless the user asked for it.
2. Reminders fire, including several times a day for one item.
3. One rule decides whether a day is done, used everywhere, including SQL-only paths.
4. A timed habit can be marked complete early.
5. Data survives a crash mid-upgrade, a bad export, and an uninstall.
6. A lock-screen/home widget shows today and can log with one tap, correct when the app is dead.
7. A craving button and a "no purchase" commitment, supporting the plan in the Health repo.

## Non-goals

- Nutrition amounts, recipes, intake maths (later, separate spec).
- Cloud sync.
- iOS.
- Reorganising the test folder; rewriting the dictation controller.

## Anti-goals

- A widget that shows substance names or anything sensitive on the lock screen.
- A craving flow with more than one tap to log.
- Refactors that land without a test proving behaviour is unchanged.
- Polishing the app instead of using it. The 14-day plan starts on the existing tracker; nothing here blocks it.

## How the work is done

- Branch `clean-slate` off `main`; one commit per fix; failing test first, then the fix.
- `npm test`, `npm run type-check`, `npm run lint` green before each commit.
- Device checks on the **dev build** (`.dev`, separate database). The release app and its data are not touched until Chris says so.
- Chris takes a manual backup (Settings → Back up) before stage 1 lands on the release app.

## Stages

Paths are under `src/` unless stated.

### Stage 0 — Safety net (small, first)

- CI: Node 22 via `.nvmrc`, `node-version-file` in `ci.yml` (both jobs), `engines.node >=22.13` in `package.json`; drop the non-existent `develop` trigger.
- **Export breaks after a habit is switched between check-off and timer.** `protocol/eventMeta.ts:33-38` is enforced on export through `protocol/bundle.ts:113`; the editor allows the switch (`components/trackerEditor/HabitEditorFields.tsx:132-138`). Fix: don't run the mode/meta cross-check on export. Test: export a habit with mixed-source events.
- Export counts rows it skipped (the repositories drop rows failing Zod with a `console.warn`) and says so in the result alert instead of looking complete.

### Stage 1 — Stop silent data changes

Each item: failing test, then the smallest fix.

1. Foregrounding can start a timer or flip a tick. `audio/habitTimerSound.native.ts:64-73` calls `play()` with no session after `stopHabitSound` (470-498); `kinds/habit/habitTimerRemote.ts:113-123` then acts on the focused habit. Fix: return when `activeSourceKey === null`.
2. Lock-screen/headset play un-ticks a done habit. `habitTimerRemote.ts:59-71`, `habitLockScreenQueue.ts:25-36`. Fix: the remote path only completes.
3. First remote action after midnight uses yesterday's maps. `store/eventStore.ts:595`, `hooks/useDayRolloverRefresh.ts:70-110`. Fix: stamp the day maps with their date; `toggleHabit` and `stopHabitTimer` derive done/total from SQLite inside the lock; remote handlers await `ensureCurrentDay()`.
4. Counter Undo and "set total" collapse the day to one event stamped now. `screens/CountersScreen.tsx:134-143` → `eventStore.ts:555-582` → `db/repositories/eventRepository.ts:194-215`. Fix: `logEvent` returns the inserted id; Undo deletes those ids.
5. `stopHabitTimer` takes the previous total from the store (`eventStore.ts:719-720`). Fix: `sumEventValues(existingEvents)` inside the lock.
6. An epoch bump drops an additive insert (`eventStore.ts:731, 745` vs `865`). Fix: a mismatch skips the mirror update only.
7. Options from a joining stop are ignored, losing `trackCompleted` (`eventStore.ts:692-705, 717`). Fix: read the options inside the lock.
8. `toggleHabit` does not re-apply done after the write (`eventStore.ts:629-630`).
9. "Every N days" is a day late across the spring clock change. `protocol/schedule.ts:26-31` floors; use `Math.round`. Test in `Europe/Paris`.
10. A calendar load error marks the store loaded-and-empty, which cancels every reminder. `store/calendarStore.ts:160-171`. Fix: leave `isLoaded` false.
11. Clock set backwards while paused makes `pauseOffsetMs` negative and drops all sessions on next start (`eventStore.ts:677-683`). Fix: clamp at 0.
12. Unhandled rejections: `habitTimerControls.ts:138` (sound not awaited), `screens/TodosScreen.tsx:102,109,127,141`, `hooks/useAppBootstrap.ts:96-120`.
13. One bad row throws for the whole load: `calendarRepository.ts:85,120,173,242`, `foodRepository.ts:241,246`, `todoRepository.ts:110`. Use `safeParse` and skip, like the other repositories.

New test harness for this stage: drive `eventStore` against an in-memory SQLite with fake timers. Nothing tests the store today.

**Stage 0–1 status (2026-11-11):** implemented by Opus on `clean-slate-stage-0-1` (20 commits), reviewed by Fable; tests 128 suites / 1535, type-check and lint green. Not yet run on a device.

Follow-ups found while implementing, to fold into the stages named:
- The day rollover stops every running timer, including one started today before the rollover ran. Guard: skip sessions whose date is today. (Stage 4, with the midnight split.)
- Saved timers load all-or-nothing: one invalid session drops them all. Load per session. (Stage 4.)
- Dashboard rows are exported without validation, so a corrupt one passes export and fails import. (Stage 4.)
- A write-epoch mismatch still drops a tick in `writeHabitTick`, the same pattern item 6 fixed for timer stops. Goes away with the database-as-only-truth change. (Stage 5.)

Device check 2026-11-11 (Pixel 9, dev build 1.6.1-dev from this branch): the evening check-in alarm is scheduled for 20:00 (`dumpsys alarm` shows it for `.dev`; the release app still has none). Tick, timer start, media-key pause/play/pause, and background → foreground all behaved; nothing started or flipped on return. Still owed: that the 20:00 notification arrives, and a lock-screen play press with a done habit focused.

Build note: a worktree needs `npm install` to link `life-moonshine-dictation` before `expo prebuild`, or the bundle fails to resolve it.

### Stage 2 — Reminders that fire

- Availability check: replace `NativeModules.ExpoPushTokenManager` (`notifications/habitReminders.native.ts:31`, `calendarReminders.native.ts:107`) with `requireOptionalNativeModule('ExpoNotificationScheduler')` from `expo-modules-core` (pattern already in `utils/protocolBackup.native.ts:19`). Share one bootstrap module between the two files. Tests must stop mocking the check into passing.
- Create a "Reminders" channel and pass `channelId`.
- Re-wire `syncHabitReminders` (parked in commit `0c9e7b1`) from a store-subscribing hook like `useEveningCheckInSync`.
- Habit config gains a list of reminder times (kefir once, sprouts twice a day), independent of the time window. Rolling DATE triggers, 14 days ahead, skipping an item already done today.
- Timer target reached in the background: schedule one notification at now + remaining on start/resume, cancel on pause/finish/reset. Needs `USE_EXACT_ALARM` in `android.permissions`.
- Settings gets a Notifications section: evening check-in on/off and time, reminders on/off.
- Verify on the phone: `dumpsys alarm` shows the alarms; one reminder actually arrives with the screen off.

**Stage 2 status (2026-11-11):** implemented by Opus on `clean-slate-stage-2` (ends 940e656), reviewed by Fable; 137 suites / 1620 tests, type-check and lint green. Pending budget is habits 200, calendar 64, evening 1, timer 1; a re-sync with nothing changed schedules and cancels nothing.

Device check (dev build from this branch): a "reminders" channel exists at high importance; adding one reminder time queued 14 daily alarms plus the evening check-in (30 alarms in `dumpsys alarm`); the 18:34 alarm fired on time with the phone locked. Still owed: ticking a habit removes today's remaining reminder; archive removes alarms; timer-target notification with the phone locked; permission-denied line in Settings.

Found on the phone, not yet fixed: the release app leaves stale "Meditation" media-session notifications behind (five were sitting in the list, days old, channel `expo_audio_channel`). The native timer service in stage 6 replaces that path; until then, dismiss the media notification when a timer session ends.

Known limit: reminders are queued 14 days ahead and topped up when the app comes to the front; two weeks without opening it and they run out. The native core can top up from a daily alarm.

### Stage 3 — One rule for "done", then early-complete

- New pure `protocol/dayOutcome.ts`: `dayFactsFromEvents`, `dayOutcome(tracker, facts) → {total, done, reason, target?}`, `habitTimerGoal(config)`. Tests first: target boundaries, empty day, play-once, counter without target (decision: not done, reason `no_target`).
- SQL aggregate returning the same facts per element per day (`SUM(value)`, `trackCompleted`, `markedComplete` via `json_extract`); first test proves `json_extract` works in both expo-sqlite and `node:sqlite`.
- Replace every copy: `isHabitDayComplete`, `isElementDayComplete`, both `completedDatesFrom*`, `habitNeedsEventMetaForCompletion`, the four counter copies, the chime, History (`screens/TrackerHistoryScreen.tsx:209` currently contradicts itself for play-once habits).
- `ElementDefinition` becomes a typed union parsed once in `elementRepository.rowToElement`; removes ~38 re-parses, several casts, and the screen-crashing `.parse` calls.
- **Early complete:** a zero-value event with `meta.source = 'manual_complete'`. The Done button is always available on a running or paused timer and on a partly-done timed habit; the seconds already logged are kept. Also fixes the play-once timer that cannot finish after the app is killed.
- A running timer past its target counts as done everywhere (header count, ordering, lock-screen queue), not only on its own card.

**Stage 3 status (2026-11-11):** implemented by Opus on `clean-slate-stage-3` (ends f259d5d), reviewed by Fable; 140 suites / 1675 tests, type-check and lint green. Checked on the phone (Life dev): Done on a running and on a partly-done timer keeps the seconds; snackbar Undo restores; a day done only by the mark shows a tick that takes the mark back after the snackbar has gone.

Decisions made in the build: a counter with no target is never done (streak 0, no done days in History); a manual Done counts for any habit; the marker is written only when the day is not already done; a running session is judged by the current goal.

Follow-ups:
- "Name on lock screen" is stored and editable but unused. expo-notifications 0.32 cannot set a notification's public version, and a channel's lock-screen setting can only hide, never reveal. The reminder's public text needs `NotificationCompat.Builder.setPublicVersion` in our own native code: moved to stage 6 (native core).
- Not yet checked on the phone: a lock-screen press after Done (must not un-tick), Done on a play-once timer restored after the app was killed, the French strings.
- Cosmetic, for the redesign: the Done button and the un-mark tick look alike, and the tick squeezes long names on the card.
- Dev tooling: `CI=1 expo start` does not watch files; restart Metro after code changes before testing on the phone.

### Stage 4 — Durability

- Each migration step plus its `schema_version` update in one `BEGIN IMMEDIATE … COMMIT` (`db/migrations.ts:242-274`); `DROP TABLE IF EXISTS` before rebuild temp tables (`db/schemaRepairs.ts:144-169`).
- Raw DB copy (`SQLite.backupDatabaseAsync`) before running migrations and before an import wipe.
- Automatic daily backup on foreground, keeping the last N, in two layers:
  - **On the phone:** a folder Chris picks once (Storage Access Framework via `expo-file-system/legacy`). Works with no network and survives uninstall.
  - **Off the phone:** the Montara home server (Chris, 2026-11-11: use it instead of Proton Drive; its file manager is being built). Upload when the server is reachable; a failed upload never blocks or loses the local copy. Blocked on the server exposing an upload interface — none exists in `~/Dev/workspace/montara-systems` yet. The app side stays behind one small `BackupTarget` interface so the server target plugs in when ready.
  - Settings copy changes from "Save a copy to Proton Drive or another app" accordingly; manual share-sheet export stays.
- Import: skip the wipe for a concept the file doesn't contain; refuse or finish while a timer runs.
- Timer dead time: persist a heartbeat and cap elapsed at it on restart. Decision needed: at midnight, end the session or split it (proposal: split, seconds go to the day they happened).
- **Own signing key** (decision for Chris): the release is signed with the public Android debug key from the Expo template, stable only by accident. Moving to a private key needs one export → uninstall → install → import, so it comes after stage 0 and the auto-backup.

### Stage 5 — Make the app safe for a second writer

- One `refreshFromDb()` on every AppState `active` and on a widget broadcast; it also re-hydrates timer sessions.
- Set SQLite `busy_timeout`.
- Split `eventStore.ts` (927 lines) now that writes are DB-derived: timer sessions as a pure reducer, day mirror, streak cache, event commands. Move `habitTimer*` out of `kinds/`. Break the `elementStore ↔ eventStore` cycle.
- JS writes a small dated JSON snapshot after every change (today's items, done state, streaks, upcoming reminders, per-item data to recompute "today" after midnight). The widget reads only this.
- A pending-actions queue the widget appends to; JS drains it into SQLite on start/foreground/broadcast. SQLite stays single-writer.

### Stage 6 — Craving button, commitments, widget

Spike first (throwaway): one native widget with one broadcast button, added to the GrapheneOS lock-screen page, to confirm a tap works while locked and what size the surface gives. Reports are mixed.

- **Build:** native Kotlin in a local Expo module (like `modules/life-moonshine-dictation`); its manifest and resources merge automatically. `widgetCategory="home_screen|keyguard"`. Midnight refresh by exact alarm, re-armed on boot/time/timezone change; the widget computes "today" at render time so a late refresh corrects itself.
- **Widget A — Today:** progress ring, today's items with one-tap done, current streaks, a 14-day strip. Timed habits show progress; tap opens the app.
- **Widget B — Next up:** the next reminders due today with one-tap done.
- **Craving button** (on A and in the app): one tap logs a timestamped craving immediately, locked or not, then offers the flow on unlock: one line written by sober Chris, a ten-minute timer, one suggested action from his list, then "survived" or "used". No debate screen.
- **Commitments:** "No purchase" and "No use" as daily check-offs; a "cravings survived" count that a lapse does not reset; streak shown alongside, not instead.
- **Lock-screen privacy:** when hosted on the lock screen, neutral labels only (configurable short names), no notes, no substance names.
- **Running timer:** Android Live Update notification (chronometer chip, lock screen), replacing the media-session trick where possible.

### Stage 7 — Cleanup and polish

- Dead code: `timeSlot`, `allowNegative`, `manual_set`, `speechRecognitionLocale.ts`, `dictation/index.ts`, test-only exports, `kinds/registry.ts` (two callers, two casts), 43 unused i18n keys.
- `alertError(title, error)` replaces 38 copies and stops English error text leaking into French; translate `'Done'`/`'done'`, sound labels; give counters an editable unit.
- Protocol must not import i18n; screens load through `useXData` hooks; stores get `clearActiveTimers()`/`resetDayState()` instead of outside `setState`.
- UI: text labels under the five tab icons; a visible running-timer indicator on every tab; explain or drop the 14-dash strip and name whose streak the header shows; History gets edit and mark-done and a real empty state; long names wrap instead of truncating; Insights opens on habits actually used and gets a scale; unlabeled icon buttons get accessibility labels; "1 items" plural.
- Journal stops loading every entry ever on open.
- Docs: README and roadmap to 1.6.1 / schema v22; one canonical rules file; correct the "append-only" and `withGuardedWrite` claims.
- Repo: three merged worktrees (~6.6 GB) and ~18 merged branches can go; `design-test` has one unmerged WIP commit — Chris decides.

## Decisions (Chris, 2026-11-11: "good on all points, go with your best judgment")

1. Private signing key: yes. Done in stage 4, after export is fixed and auto-backup exists, with one export → uninstall → install → import.
2. A timer running past midnight is split: seconds go to the day they happened.
3. Merged worktrees and merged local branches are removed in stage 7. `design-test` is kept (one unmerged commit). Remote branches are listed for Chris and not deleted by an agent.
4. Lock-screen labels: each tracker gets an optional short "lock-screen name"; when empty the widget shows the icon only.
5. Status: approved. Implementation is done by Opus sessions, one stage at a time; Fable does design and review only.

Still open (not blocking): the sober-self line and ten-minute actions for the craving flow (Health repo, `mind/plan.md`); how the Montara server accepts a backup file.

## Architecture direction

An honest read of the app against its goals, and what changes because of it.

**What is good and stays.** Local-first SQLite, strict TypeScript, Zod at the edges, one declaration per table (`PERSISTED_CONCEPTS`), a coherent visual system with tests guarding it.

**Where it fights the goals.**

- The goals are now mostly things that must work while the app is closed (widget, lock screen, reminders, timers). React Native runs none of that; each needs native Android code. A Kotlin rewrite would fit better on paper but costs months and is the "rebuild instead of use" trap. So: **no rewrite; grow a small native core.** One local Expo module owns timers (foreground service, notification with Done/Pause, Live Update), alarms, the widget, and the snapshot. React Native keeps the screens. This replaces the media-session trick, which is the source of the worst bugs in stage 1; stage 1 only patches its guards.
- The in-memory copy of today's state is a hand-synchronised cache (write epochs, load generations, optimistic patches). Most race findings live there. Local SQLite writes take milliseconds, so the optimism buys nothing. **Direction: the database is the only truth for today's state.** Open the DB with `enableChangeListener`, and have today's totals/done/streaks re-query on change (`addDatabaseChangeListener`, present in the installed expo-sqlite). Writes become: lock → write → done. Epochs and optimistic patches for events go away, and widget-queued writes appear in the UI with no special path. This is the real form of stage 5's `refreshFromDb()`; do the patch first, then this.
- "Life Protocol v1", kinds registry, bundle cross-validation: framework ceremony for two tracker kinds and one user. It produced the export-breaking check. Treat it as an app schema: validate on DB read and on import, nothing more. No new abstractions for hypothetical kinds.
- Completion is recomputed from the current config, so editing a goal rewrites history. Record the goal in force on the event when it is written (`meta.goalSeconds` / `meta.goal`), and let `dayOutcome` prefer it.
- Breadth over depth. Calendar with recurrence, weather, nutrition catalogue, journal chapters and on-device dictation exist; reminders have never fired. The last ~15 commits before this review are all appearance. **Freeze:** no appearance passes and no new surfaces until stage 6 ships.
- Five tabs split one question ("what do I do today?") across screens. **Today-first:** one Today list holding habits, counters, due reminders and todos due today, which is also exactly what the widget shows. Counters and Nutrition tabs fold away or hide until used. Done in stage 7 after the widget proves the content.
- Tests guard looks (contrast, opacity, motion) more than behaviour. New tests in every stage drive real stores against real SQLite.
- Backups leaving the phone are plain JSON containing the journal. Encrypt with a passphrase before upload to any server.

## Stage 0 addition

The one-line notification availability fix (stage 2, first bullet) moves into stage 0 so the evening check-in starts working at once. The rest of stage 2 stays where it is.

## Product changes (agreed with Chris 2026-11-11)

These come after stage 6 unless noted, each as its own small spec before building.

1. **Routine player, at his pace.** A routine is an ordered set of existing habits (e.g. morning: meditation, breathing, mobility, face routine, creatine). One Start begins the first item. When an item ends the player does **not** auto-advance: it stops on a "Next: Breathing" card with Start, Later and Skip. Time between items is not counted and nothing nags; he can do other things in between. The routine stays open and resumable for the day, and the widget's "next up" shows the waiting item. Any running item can be paused. Chris's reason: today's flexibility to move around between items matters; the player must remove the "what's next" decision, not the freedom.
2. **Three states: full, minimum, missed.** Each habit may define a minimum version (e.g. 2 minutes). Minimum keeps the chain alive and is shown differently from full. Builds on `dayOutcome` and the early-complete event from stage 3.
3. **Strength score beside the streak.** A percentage that falls a little on a miss and recovers, instead of only a counter that resets.
4. **Quit tracker for "No Smoking".** Time-since clock, money not spent, morning pledge, evening check, cravings survived. A slip is logged; the rest stays. Lives with the commitments in stage 6.
5. **His own voice at the craving.** Record a short message once; the craving flow plays it, then offers three large buttons that start a ten-minute timer (yoga, walk, breathing). Needs audio recording (today dictation produces text only). Part of the stage 6 craving flow.
6. **Today-first layout** (already in Architecture direction): one Today screen grouped Morning / Day / Evening, a large "next up" card, done items collapsing to one line, seven-day dots per row, main commitment pinned on top. Counters and Nutrition tabs hidden until used.
7. Smaller, later: weekly summary file for the Health sessions; reminders at usual buying times; one-tap weekly scoreboard to Donna; a starter food list of ~150 plants; "park it until 9am" after an argument; evening wind-down routine.

## Left to the builder

Internal names, file layout inside the new modules, test structure, exact widget layout within the constraints above.
