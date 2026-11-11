# Stage 6 — native core, urges, commitment, lock-screen widget

Date: 2026-11-11 · Design by Fable, built by Opus in five parts (6a–6e), each on its own branch, reviewed and phone-tested before the next.
Chris, 2026-11-11: "plan it and have Opus build. You are the coordinator." So this is approved to build; product choices marked **default** are reversible and Chris can change them.

Read with: `2026-11-11-clean-slate-and-widget-design.md` (stages 0–5 and their status notes), `docs/widget-contract.md` (v1, extended here), `docs/mockups/DECISIONS.md` (widget decisions, Night road, lock-screen spike results), `docs/mockups/night-road.html` (the four lock-screen moments), `docs/mockups/APP-REDESIGN.md` (decisions 5 and 7 bind this stage: sound on habits is a hard requirement; no glow).

## What must be true at the end

1. From the lock-screen widget page, without unlocking, Chris can: start a timed habit and hear its sound, pause, resume, finish it (Done) or throw it away; tick a check-off habit; tap a counter button; log an urge and ride a ten-minute countdown.
2. All of that works when the React Native app is not running, and survives the phone sleeping.
3. The widget shows: time clear, today's count, the next thing to do, and one line in his own words. Neutral labels only on a locked phone.
4. The app shows the same truth as the widget, always. SQLite still has exactly one writer: JavaScript.
5. Pressing play in the app still starts the breathing guide or the music in one tap.

## The shape

```
                 taps                      reads
 Lock-screen widget ───► LifeCore (Kotlin, one local Expo module) ◄─── snapshot.json (JS writes)
                          │  TimerService (foreground, media playback, ExoPlayer)
                          │  timer.json  (native writes: the running session)
                          │  pending-actions.jsonl (native appends: results)
                          ▼
                 React Native app: reads timer state through the module,
                 drains the queue into SQLite, rewrites the snapshot
```

- **Native owns the running timer**: its clock, pause state, sound, goal alarm and notification. React Native becomes a client: it asks the module to start/pause/resume/finish/discard and subscribes to state. This replaces the expo-audio keepalive loop and media-session trick for timers.
- **Native never touches SQLite.** A finished session becomes one line in the queue; JavaScript turns it into events (it already owns the midnight split, the goal recording and the done rule).
- **The widget never waits for JavaScript.** It draws from `snapshot.json` plus `timer.json` plus the not-yet-drained lines of the queue (a small overlay, rules below), so a tap shows at once even with the app dead.

## 6a — Native timer core (biggest, first)

New local module `modules/life-core` (same pattern as `modules/life-moonshine-dictation`; manifest, resources and service merge automatically; no hand edits in `android/`).

**TimerService** — a foreground service, type `mediaPlayback`, started by a user tap (widget broadcast, notification action, or the app). The spike showed a user-tap start from a locked phone is allowed.

- One session at a time (today's rule). State lives in `files/widget/timer.json`, written atomically on every transition: tracker id, lock-screen name, icon key, goal (`seconds` / `play_once` with track seconds / `open`), sound track id or none, `startedAt`, `pausedAt`, `pausedMs`, the app day it started on, `goalReachedAt`, a heartbeat written every 30 s while running. Elapsed time is always computed from these instants, never from counting ticks.
- **Sound**: Media3 ExoPlayer inside the service. A habit with a track plays it; with a seconds goal it loops until the session ends; with no goal it plays once and its end finishes the session (`trackCompleted`). A habit without a track plays the existing silent keepalive so the process stays awake. Audio focus handled properly: a phone call or other media pauses the session; headset unplug pauses. The five tracks and the chime move into the module's Android resources so they exist without Metro; the JS catalog keeps ids, labels and durations and a test asserts the two lists match.
- **Goal**: an exact alarm at the moment the seconds goal will be reached (re-armed on pause/resume). At the goal: play the chime, mark `goalReachedAt`, update the notification; the timer keeps running (today's behaviour).
- **Notification** (ongoing, own channel, low importance, no sound): shows a chronometer and Pause/Resume and Done actions. Its public version (what a locked phone with hidden content shows) uses the lock-screen name, or just "Timer" when there is none. Verify from current Android documentation whether the promoted "Live Update" style is available on the target SDK and use it only if it is; otherwise a standard ongoing chronometer notification.
- **Ending**: Done → stop, append a `timer_session` line (below) with `markComplete: true`; Stop from the app's normal stop → same with `markComplete: false`; Discard → append nothing; track ended (play-once) → `trackCompleted: true`. Then stop the service and remove `timer.json`.
- **Death and reboot**: if the process is killed, the service is not restarted with sound; on next start of the module (app open, widget tap, boot receiver) a `timer.json` whose heartbeat is stale is treated as paused at the last heartbeat (same rule as stage 4), and stays resumable.
- **Midnight**: native does nothing special; the session line carries its instants and JavaScript splits the seconds by day (stage 4 function).

**Queue contract v2** (update `docs/widget-contract.md` and the Zod schemas together):

- New result line `timer_session`: `id`, `trackerId`, `startedAt`, `endedAt`, `pausedMs`, `activeSeconds`, `goalSecondsInForce` or null, `trackCompleted`, `markComplete`. Applied exactly once by id: the event rows it creates carry ids derived from the action id plus the day, so a second apply inserts nothing.
- The v1 control lines `timer_start` / `timer_pause` / `timer_resume` / `timer_done` / `timer_discard` are **removed**: control is native now. The drain skips them if found.
- `habit_complete` and `counter_add` stay as they are.

**JavaScript side**

- A typed wrapper `src/core/lifeCore.ts` over the module: `start(tracker)`, `pause()`, `resume()`, `finish({markComplete})`, `discard()`, `getState()`, and a state-change subscription. On web and in Jest, a pure TypeScript fake with the same interface (the reducer from stage 5 is the fake's brain).
- The stores' timer session state becomes a mirror of the module's state; `src/store/events/timerSessionActions` / `timerPersistence` and `src/habitTimer/*` shrink to calls into the wrapper. The media-session remote controls, lock-screen focus queue, keepalive player and JS heartbeat are deleted. The completion chime for check-off habits may stay on expo-audio.
- When native reports a state change or the app comes to the front: drain the queue, then refresh (existing `refreshFromDb`).
- Sound preview in the habit editor keeps working.
- No behaviour the user relies on is lost: one tap plays; Done early works (stage 3); Undo of Done works; midnight split and dead-time cap work (stage 4); the un-mark tick works.

**Tests**: JVM unit tests for the pure Kotlin parts (state transitions, elapsed-time maths, stale-heartbeat rule, queue append with the inode check); the JS suites run against the fake. What only a phone can show is listed for the device check.

**Stage 6a status (2026-11-12):** implemented by Opus on `clean-slate-stage-6a`, not yet reviewed or run on a device. JS 153 suites / 1784 tests, type-check and lint green; Kotlin 30 JVM tests (`cd android && ./gradlew :life-core:testDebugUnitTest`); `assembleDebug` builds. Module `modules/life-core`: `TimerSession` (pure state), `TimerJson`/`TimerFile` (`timer.json`), `PendingActionsQueue` + `OsQueueFiles` (append with the inode check), `TimerCore` (the process's one session), `TimerService`, `TimerNotification`, `LifeCoreModule`. JS: `src/core/lifeCore.ts` (wrapper, fake in `fakeLifeCore.ts`), `src/habitTimer/habitTimerControls.ts`, store timer actions as calls into the wrapper. Contract v2 in `docs/widget-contract.md`.

Verified in the installed SDK and docs, not guessed: `mediaPlayback` needs `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, has no runtime prerequisite or time limit, and cannot be started from `BOOT_COMPLETED` on Android 15+; a start from a widget or notification tap is exempt from the background-start ban. The Live Update request (`EXTRA_REQUEST_PROMOTED_ONGOING`, `setRequestPromotedOngoing`) is in the android-37 stubs but not android-36, which this app compiles against, so the notification is the standard ongoing chronometer one; compiling against 37 would allow it. Media3 1.8.0 (the version expo-audio already brings): `setAudioAttributes(…, handleAudioFocus = true)`, `setHandleAudioBecomingNoisy`, `WAKE_MODE_LOCAL`, `RawResourceDataSource.buildRawResourceUri`.

Decisions and differences from the design above:
- A fresh process pauses a running session at its last heartbeat whatever the heartbeat's age (not only when older than 60 s): the service lives in the app's process, so a fresh process knows nobody played it. No boot receiver: the next start of the module applies the rule, and a `mediaPlayback` service may not be started from boot anyway. The 6c widget will need one for its own refresh.
- Each session has a `sessionId`, which becomes its `timer_session` line's id, so a crash between the append and the delete of `timer.json` cannot log a session twice. `endedAt` is when active time stopped (the pause it ended in), so a session paused before midnight and finished later gives its seconds to the right day.
- `start` for another tracker is refused natively; the app finishes and logs the running one first. In-app finishes apply the record at once through the drain's applied log; the copy native queued is then a duplicate. Every queue action is now logged after it is applied.
- Audio focus: a call (transient loss), other media (permanent loss) and unplugged headphones pause the session; it waits for Resume. The silent keepalive takes no focus, so a no-sound timer does not stop other music, and a call does not pause it.
- A play-once track resumed after the process died starts at the session's active time, not from the top. A track shorter than a seconds goal is followed by the silent keepalive.
- No chime when today's goal was already met before the session started.
- Midnight: native does nothing; the mirror shows a session carried over from yesterday from local midnight, and the rollover still finishes a session paused before midnight. The goal alarm of such a session still counts yesterday's logged seconds (edge case left).
- The notification's strings are native (`values`, `values-fr`) and follow the phone's language, not the app's language setting.
- The web and Jest fake keeps the session in memory only; a page reload loses it.
- Headset media buttons no longer control timers (the media session is gone). The editor preview plays natively and does not report its end; its button stays on "Stop preview" until pressed.

Deleted: the expo-audio timer player, keepalive and lock-screen metadata (`src/audio/habitTimerSound*`, `habitTimerPlayback`, `bundledHabitSoundAssets*`, `lockScreenSeekDetect`, `preloadConfiguredHabitSounds`, `habitCompleteSound*`), the media-session remote controls and lock-screen focus queue (`src/habitTimer/habitTimerRemote`, `habitLockScreenQueue`, `habitTimerPresentation`, `habitTimerLockScreen*`), the JS heartbeat and SQLite timer persistence (`timerPersistence`, `activeTimerRepository`; the old `active_timer_sessions` setting is left unread), the JS goal notification (`habitTimerNotification*`, `habitTimerTarget`, `useHabitTimerNotificationSync`), `assets/sounds/`, and their tests.

Phone check owed (the list above, plus): the notification and its public version on the locked phone with hidden content; Pause/Resume/Done from it while locked; the goal chime with the screen off (exact alarm); a call and headphone unplug pause it; a play-once track's end logs the session with the chime; kill from recents: with a foreground service the process usually survives, so the timer keeps going; force-stop, then reopen: paused at the last heartbeat; Done after that logs once; a timer running across midnight logs two events; the editor preview; one leftover expo-notifications "Timer done" alarm from the previous build may fire once.

## 6b — Urges and the commitment (data and rules, no new screens)

**Urge** — a new table through `PERSISTED_CONCEPTS`: `id`, `at` (instant), `day`, `outcome` (`null` open, `rode_out`, `used`), `resolved_at`, `source` (`widget` / `app`). In export/import and clear-data like any concept.

- Queue line `urge_logged` (`id`, `at`, `day`): inserts the urge, open. Idempotent by id.
- Queue line `urge_resolved` (`id` of the urge, `outcome`, `at`).
- An urge still open at the end of its ride (ten minutes after `at`) with no "used" is counted as ridden out the next time JavaScript runs. Rule zero of his plan: logging is one tap and never asks a question first.
- Count of urges ridden out is a running total that nothing resets.

**Commitment** — a third tracker kind, `commitment` (the `ElementDefinition` union from stage 3 gains a member; exhaustive switches will point at every place to decide):

- Config: `lockScreenName` (**default** "Clear"), `clearSince` (instant), `ownLines` (up to five short lines in his words; the one shown rotates at milestones), `insteadHabitIds` (up to two timed habits offered as the ten-minute alternative), `rideSeconds` (**default** 600).
- Milestones ("lamps"): 24 h, 48 h, 3 d, 5 d, 7 d, 10 d, 14 d, then every 7 d. Pure function, tested at the boundaries.
- A slip: `{at}` appended to a `slips` list (own table or events, builder's choice with the rule "append-only"). It moves `clearSince` to that instant. It does **not** reset urges ridden out, lamps already passed stay in history, and the road only dims that day's dash.
- `dayOutcome` for a commitment: done when the day contains no slip. Streak and the 14-day strip come from that.
- **Default**: at most one active commitment. The existing "No Smoking" check-off habit is left alone; Chris decides later whether the commitment replaces it.

**Snapshot v2** additions: `commitment` (lock-screen name, `clearSince`, next lamp instant and label, lamps passed, current own line, urges ridden out total, urges today, `insteadHabits` with id/lock-screen name/seconds, 14-day strip) and `ride` (the open urge and when its ride ends) or null. Also per tracker a `sevenDays` strip. Still nothing from journal or notes.

In-app surface for now, in the existing look and minimal: creating/editing the commitment through the existing tracker editor (name, lock-screen name, own lines, instead habits), a "slip" action behind a confirm, and the commitment shown as a card on Habits with its clock and an Urge button. The full urge screen comes in 6d.

**Stage 6b status (2026-11-12):** implemented by Opus on `clean-slate-stage-6b` (af4e5d1 … this note), not yet reviewed or run on a device. JS 160 suites / 1869 tests, type-check and lint green; the Android JS bundle exports. No Kotlin touched (nothing native reads the snapshot or the urge lines yet), so the shared fixtures are unchanged. Urges: table `urges` (schema v23) through `PERSISTED_CONCEPTS`, `src/protocol/urge.ts`, `urgeRepository`, `useUrgeStore`. Commitment: `src/protocol/kinds/commitment.ts` (config, lamps, own line, instead-habit checks), `CommitmentEditorFields`, `kinds/commitment/CommitmentWidget` and `screens/habits/CommitmentCard`; strips in `src/utils/dayStrip.ts`, clock and lamp labels in `src/utils/commitmentFormat.ts`. Contract v3 (snapshot version 2, queue lines `urge_logged` / `urge_resolved`) in `docs/widget-contract.md`. Snapshot: 6.3 KB for nine trackers (3.7 KB before), 7.8 KB with a commitment and an open ride.

Decisions and differences from the design above:
- Slips are events on the commitment (value 1, `meta.source: 'slip'`), so they are append-only, cleared, exported and imported with the rest of its history, and the day-facts aggregate already counts them. A slip and the move of `clearSince` are written in one transaction.
- A day before the commitment (or any tracker) was created counts neither way: `not_counted` in strips, nothing plotted in History and Insights, outside streaks. Days between an earlier chosen `clearSince` and the creation day are not counted either (there is no way to choose one yet: a new commitment is clear from now).
- Streaks and strips now judge every day in the window, logged or not; for habits and counters nothing changes (an empty day was never done), for a commitment a quiet day is kept. A slip today leaves the run before it standing until tomorrow, like any tracker's not-done today.
- The ride length comes from the commitment that is not archived; without one, 600 s. It is read when the urge is settled, so changing it (no editor control yet) moves the end of an open ride.
- An urge resolved keeps its first outcome. A "used" that arrives after JavaScript already rode the urge out changes nothing; `refreshFromDb` drains the queue before it rides anything out, and the card refreshes at the ride's end, so this needs the widget's line to arrive late.
- "I used" resolves the urge only; it never logs a slip.
- Queue: `urge_resolved` carries its own line `id` plus `urgeId` (the urge's id is the `urge_logged` line's id, and the applied log is keyed by line id). Every `urge_resolved` is applied after the rest of its file, so one written before its log still lands. `future_day` applies to urge lines too.
- The commitment is also a tracker in the snapshot (`kind: "commitment"`, `unit: "slips"`, always due), so the widget's "3 / 7" counts it exactly as the app's "N of M" does. Added beyond the design: `commitment.id`, `nextLamp.hours`, `rideSeconds` (an `urge_logged` the widget overlays needs the ride length) and the reasons `clear` / `slipped`.
- "N of M done" on Habits counts the commitment (done while it holds no slip). The evening check-in never counts it: its wording is "N things still to do", and a commitment's day has nothing left to do; counting a slip there would be the only nag about one. The header's "days in a row" stays the best habit run.
- One active commitment: creating a second, or restoring an archived one beside it, is refused with "There is already a commitment. Archive it before starting another." The library shows it in its own section, with no add button while one is active.
- Instead-habits are checked at save (each a timed habit on Home); one deleted, archived or switched to check-off later is left out when read. A habit whose timer is already running is not offered during a ride (pressing it would pause it).
- The lock-screen name defaults to "Clear" in both languages; the own lines and the lock-screen name are stored as typed. The editor says the current line can appear on the lock screen. The commitment has no icon.
- Clear data (activity or everything) still deletes urges like any history: "nothing resets the count" holds for slips and edits, not for an explicit wipe.

Missing from the design, left open:
- The snapshot carries only the current own line. A lamp passed while the app is not running keeps the old line on the widget until the app writes again; carrying all lines would let the widget rotate them itself (a privacy call for Chris, since every line would then sit in the file).
- Nothing edits `rideSeconds` or an existing `clearSince`; both have defaults only.
- Undo of a slip: not offered (append-only). A slip logged by mistake stays; History shows it.

Phone check owed (6b): create the commitment in the library (name, lock-screen name, lines, two timed habits); its card on Habits ticks ("2d 14h", next lamp); Urge logs at once and counts down; an instead-habit starts its timer with sound; "I used" ends the ride; a ride left alone shows as ridden out after it ends and after a return to the app; Log a slip resets the clock and leaves the ridden-out count; History shows kept and slipped days; "N of M" includes it; export → import round trip keeps the commitment, its slips and the urges; French strings.

## 6c — The lock-screen widget

One `AppWidgetProvider` in `life-core`, `widgetCategory="home_screen|keyguard"`. The lock-screen page gives one fixed box of 447 × 298 dp: design for exactly that; on the home screen allow the same size.

**Rendering**: RemoteViews with a small set of XML layouts, one per state. Buttons are broadcasts to a receiver in the app's process. The live clock is a `Chronometer`. The road picture is drawn natively onto a bitmap sized to the box and set on an `ImageView` (keep it well under the RemoteViews bitmap limit; verify the limit). Refresh on: any tap, snapshot change (JS notifies the module after writing), timer transitions, an exact alarm at local midnight and at the next lamp, boot, time or zone change.

**Which state shows** (first match wins):

1. **Timer** — a session exists in `timer.json`. Lock-screen name, large chronometer, "of 15:00" or nothing, thin progress line; buttons: discard (square), pause/resume (lit), done (check).
2. **Ride** — an urge's ride is running. "Ride it to the lamp", countdown chronometer, the road with the car and the lamp; buttons: the first instead-habit ("10 min" + its lock-screen name, starts that timer and moves to state 1), and "Used" small and quiet (logs the outcome, no comment, no colour of failure).
3. **Home** — otherwise. Left: time clear (large, "2d 14h"), label = commitment lock-screen name. Right: today's count "3 / 7". Middle: the road (last 7 days as dashes, next lamp). Bottom row: the next thing due (lock-screen name or icon; a play button for a timed habit, a circle for a check-off, the first quick button for a counter) and the **Urge** button. When nothing more is due today, the next-thing slot shows the current own line instead.

If there is no commitment, the clear-time block is replaced by today's count large and the best current streak. If the snapshot is missing or unreadable the widget shows the app icon and "Open Life", nothing else.

**Overlay rules** (so a tap shows before JavaScript runs): for every queue line not yet in a snapshot newer than it — `habit_complete` → that tracker done; `counter_add` → total += amount, done if ≥ target; `timer_session` → total += activeSeconds, done if `markComplete`, `trackCompleted`, or total ≥ goal; `urge_logged` → urges today + 1, ride starts; `urge_resolved` → ride ends. After local midnight with a stale snapshot, apply the "working out today without the app" section of the contract. These rules live in one Kotlin file with unit tests that use the same cases as `dayOutcome`'s TypeScript tests (export the cases as a shared JSON fixture so both languages run them).

**Privacy**: when the host is the keyguard, only `lockScreenName`, icons, numbers, and the own line are shown. Real tracker names never. The own line is his text and his choice; the editor says it will show on the lock screen.

**Look**: Night road, flat. Glass tile `#1A2030 → #070A10` with a 1 dp top highlight, cream `#EFE9DC` text, one lit colour per state as a 1.5 dp ring or thin line (violet home, teal timer, amber ride). No blur, no halo, no drop glow. Inter (bundle ExtraLight/Light/Medium in the module; verify RemoteViews can use bundled fonts on this Android version, otherwise render large numerals into the bitmap and use the system font for small labels). Minimum touch target 48 dp.

**Waking JavaScript**: after a tap, if the React Native app is alive, the module emits an event and JS drains at once. If it is not, nothing more is needed for correctness (the overlay covers display; the drain happens on next open). Investigate a headless JS task to drain in the background so reminders for a just-ticked habit get cancelled; build it only if it is reliable in a release build, and report either way.

## 6d — The urge flow in the app

One screen, reached from the Urge button in the app or by opening the app while a ride is running. Built with the first pieces of the Night road kit (tokens, glass surface, pill and round buttons, type roles) — only what this screen needs; the kit grows in the redesign.

- Top: countdown to the lamp, the road with the car.
- His own line, large, Light weight.
- Up to two big buttons that start an instead-habit timer (one tap, sound included).
- "Play my note" if a voice note exists (6e).
- Bottom, small: "I used". One tap, then one optional line "what led to it" (skippable), then back. No lecture, no red.
- When the ride ends untouched: "Ridden out. That's N." and the count.
- No debate, no feed of quotes, no options menu. Simple wins in a craving.

## 6e — Finish

- Voice note: record once (unlock required, microphone permission asked then), stored in the app's files, played by the service from the widget's ride state and the urge screen.
- Reminder notifications get a public version using the lock-screen name (the follow-up from stage 3), built through the module.
- Clear-data deletes the widget files; an import that wipes settings keeps the applied-actions log safe (stage 5 leftovers).
- Second widget "Next up" (a short list with one-tap done) only if the single widget proves too small in real use.

## Order, branches, checks

| Part | Branch | Depends on | Phone check before moving on |
|---|---|---|---|
| 6a | `clean-slate-stage-6a` | 5 | play starts sound from the app; lock the phone, sound continues; notification Pause/Done work locked; kill the app from recents mid-timer, reopen: paused at last heartbeat; Done logs minutes; goal chime with screen off; a call pauses it |
| 6b | `clean-slate-stage-6b` | 6a | create the commitment; urge from the card, an instead-habit starts with sound, "I used"; a ride left alone counts as ridden out; slip; History; export → import round trip |
| 6c | `clean-slate-stage-6c` | 6b | add the widget on the lock-screen page; every button while locked; with the app force-stopped; after midnight without opening the app; neutral labels only |
| 6d | `clean-slate-stage-6d` | 6c | Urge from widget → unlock → flow; instead-habit starts with sound; "I used" path |
| 6e | `clean-slate-stage-6e` | 6d | record and play the note locked; reminder text on a locked phone |

Rules for every part: test-first; strict typing; no dead code; `npm test`, `npm run type-check`, `npm run lint` green before each commit; Kotlin unit tests run with Gradle and are reported; no push; nothing touches `com.lifeapp.dashboard`, only the `.dev` build; never invent an Android API — check current official documentation for anything about foreground services, exact alarms, widgets on the lock screen, RemoteViews limits and Live Updates on the SDK this project targets, and say what was verified.

## Open for Chris (none blocks the build)

- The own lines and the two instead-habits: his to write and pick in the editor. Until then the widget shows numbers only and no ten-minute button.
- Whether the commitment replaces the "No Smoking" check-off.
- The words "Clear" and "Urge" on a locked phone: both editable per the lock-screen name; "Urge" can become an icon only.
