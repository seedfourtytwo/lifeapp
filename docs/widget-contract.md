# Widget contract

Contract version 5 (stage 6e). What the JavaScript app writes for the lock-screen widget and the native reminder scheduler, what the native core (`modules/life-core`) writes about the running timer, and what native may write back. The Zod schemas in `src/protocol/` (`widgetSnapshot.ts`, `widgetActions.ts`, `coreTimer.ts`, `reminderPlan.ts`) are the same contract in code, and the two change together.

SQLite has one writer: the JavaScript app. Native code never opens the database. It reads the snapshot and the reminder plan, owns `timer.json`, and appends to the pending-actions queue, nothing else.

Changes from version 4: the reminder plan (`reminders.json`) is new, and habit reminders are posted natively from it (see "Reminder plan"); the app no longer queues them in expo-notifications. The voice note (`voice-note.m4a`) is new: at most a minute of AAC in MPEG-4, never exported; the widget's ride shows "Play my note" while the file exists. The snapshot and the queue lines are unchanged.

Changes from version 3: the snapshot is version 3. A timer habit's `timer` gains `trackId` and `loop`, so the widget can start a session with its sound; the commitment's `ownLine` becomes `ownLines`, every line with the rule for which one shows, so the widget moves on to the next line at a lamp without the app. The app tells the module after each snapshot write, and the module tells the app when the widget queues a line (see "The widget"). Queue lines are unchanged.

Changes from version 2: the snapshot is version 2. It gains `commitment` and `ride` at the top, a `sevenDays` strip on every tracker, a third tracker kind `commitment`, and the reasons `clear` and `slipped`. The queue gains two lines for urges, `urge_logged` and `urge_resolved`, with the drop reason `urge_missing`; a queue line's `trackerId` belongs to the tracker lines only.

Changes from version 1: the running timer is owned by native code, so the five timer control lines (`timer_start`, `timer_pause`, `timer_resume`, `timer_done`, `timer_discard`) are gone and a drain skips them as unknown; native appends a `timer_session` line when a session ends; `timer.json` is new. `habit_complete` and `counter_add` are unchanged.

## Location and encoding

Both files live in the app's private files directory, in a `widget` folder:

| File | Path on the phone | Written by | Read by |
|---|---|---|---|
| Snapshot | `File(context.filesDir, "widget/snapshot.json")` | JavaScript | widget |
| Timer | `File(context.filesDir, "widget/timer.json")` | native core | widget, JavaScript (through the module) |
| Pending actions | `File(context.filesDir, "widget/pending-actions.jsonl")` | native (append) | JavaScript |
| Reminder plan | `File(context.filesDir, "widget/reminders.json")` | JavaScript | native reminder scheduler, native notifications (language) |
| Voice note | `File(context.filesDir, "widget/voice-note.m4a")` | JavaScript (a finished expo-audio recording, moved in) | native core (`VoiceNoteService` plays it) |

`context.filesDir` is `/data/user/0/<package>/files` (`com.lifeapp.dashboard`, or `com.lifeapp.dashboard.dev` for the dev build). The folder may not exist before the app's first write; create it if the widget writes first.

Text is UTF-8 with no byte order mark. Instants are ISO-8601 in UTC with milliseconds and a `Z` (`2026-03-10T08:32:00.500Z`). Local dates are `YYYY-MM-DD` and local clock times `HH:mm`, both in the zone named by `day.timeZone`.

## Snapshot

`src/protocol/widgetSnapshot.ts` (`WidgetSnapshotSchema`). One JSON object: 6.3 KB for seven habits and two counters, 7.8 KB with a commitment and an open ride.

### When it is written

After every write the app calls the module's `snapshotWritten()`, and the widget redraws from the new file at once.

After any change to what it shows (a tick, a counter tap, a timer start, pause, resume, stop or Done, an urge logged or resolved, a slip, an edit, an archive, a delete, a reorder, a day rollover), and after every `refreshFromDb()` (each time the app comes to the front). Changes within 500 ms of the first share one write. A timer's 30-second heartbeat alone does not cause a write: the session fields below let the widget run the clock itself.

### Atomic replace

The app writes `widget/snapshot.json.tmp`, then renames it over `widget/snapshot.json` (`java.io.File.renameTo`, a rename(2) in one directory). A reader that opens `snapshot.json` gets either the previous complete file or the new complete file. Read the whole file in one go and parse it; never read `snapshot.json.tmp`. If the file is missing or does not parse, show nothing rather than guess.

### Fields

| Field | Type | Meaning |
|---|---|---|
| `version` | `3` | Format version. A reader that does not know the version shows nothing. |
| `generatedAt` | instant | When the file was built. |
| `day.date` | local date | The app day described. The app day is the local calendar day; it turns at local midnight. |
| `day.endsAt` | instant | The next local midnight. From then on the per-day fields below (`done`, `reason`, `total`, `streak`, `nextReminders`) describe yesterday. |
| `day.timeZone` | string | IANA zone of the phone at `generatedAt` (`Europe/Paris`). |
| `day.utcOffsetMinutes` | integer | Offset from UTC at `generatedAt`, minutes east (Paris: 60 in winter, 120 in summer). |
| `trackers` | array | Every tracker on Home (archived ones are left out), in Home's order. Today's count ("3 / 7") is the `done` ones among those `dueToday`, the commitment included. |
| `commitment` | object \| null | The commitment not archived (there is at most one); see below. Null when there is none. |
| `ride` | object \| null | The latest urge's ride while it is open: `urgeId`, `startedAt`, `endsAt` (instants). Null when no urge is open. At `endsAt` the ride is over even if the app has not run: the urge counts as ridden out from then. |
| `nextReminders` | array | Reminders still to come today, earliest first; see below. |

Each tracker:

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | The tracker. Use it in pending actions. |
| `kind` | `"habit"` \| `"counter"` \| `"commitment"` | |
| `name` | string | The real name. **Never show it on the lock screen.** |
| `lockScreenName` | string \| null | The neutral name for a locked phone, at most 20 characters. Null: show the icon only. Counters always have null; a commitment always has one ("Clear" unless chosen). |
| `icon` | string \| null | A MaterialCommunityIcons glyph name (`meditation`, `pill`, `water`…), or one of the app's own: `push-up`, `pull-up`. Null: no icon chosen. |
| `dueToday` | boolean | Scheduled on `day.date` (see `schedule`). Counters and the commitment are always due. A habit with a time window is due all day; `visibleOnlyInTimeRange` says whether the app hides it outside the window. |
| `done` | boolean | The day counts as done. A commitment's day is done while it holds no slip. |
| `reason` | string | Why. One of `clear`, `slipped` (commitment); `checked`, `not_checked` (check-off habit); `target_met`, `under_target` (seconds goal or counter target); `track_finished`, `track_not_finished` (timer that plays a track once); `time_logged`, `nothing_logged` (timer with no goal); `marked_complete` (Done pressed before the goal); `no_target` (counter with no target, never done); `running_past_goal` (a timer still running has passed its seconds goal; its seconds are not logged yet). |
| `total` | number | Logged today, in `unit`. A running session's seconds are not in it. A commitment's is its slips today. |
| `target` | number \| null | The amount that finishes the day, in `unit`. Null when there is none. |
| `streak` | integer | Days in a row done, ending today if today is done, else yesterday. |
| `schedule` | object | See "Working out today without the app". Counters and the commitment: `{"type":"daily"}`. |
| `reminderTimes` | array of `HH:mm` | Local times this tracker reminds at on a due day, earliest first. Counters and the commitment: empty. |
| `unit` | string | Habits: `"ticks"` (check-off) or `"seconds"` (timer). Counters: their own unit text (`"glasses"`). Commitment: `"slips"`. |
| `sevenDays` | array of 7 | The last seven days ending on `day.date`, oldest first: `{date, state}`, `state` one of `done`, `not_done` (today: not yet; a commitment: a slip), `not_due` (not scheduled), `not_counted` (before the tracker existed). |

Habits only:

| Field | Type | Meaning |
|---|---|---|
| `trackingMode` | `"boolean"` \| `"timer"` | Check-off or timer. |
| `timeRange` | `{start, end}` \| null | Local `HH:mm` window. |
| `visibleOnlyInTimeRange` | boolean | The app hides the habit outside `timeRange`. |
| `timer` | object \| null | Null for check-off habits. |
| `timer.goal` | object | `{"type":"seconds","seconds":900}`, `{"type":"play_once","trackSeconds":912}` (done when the track ends) or `{"type":"open"}` (done once any time is logged). |
| `timer.trackId` | string \| null | The bundled track a session plays (`meditation15min`), or null for silence. With `loop` and `goal`, what the widget starts a session with. |
| `timer.loop` | boolean | The track loops until the session ends (true), or plays once. |
| `timer.session` | object \| null | The running or paused session, or null. |
| `timer.session.startedAt` | instant | When it started (local midnight for one carried over from yesterday). |
| `timer.session.pausedAt` | instant \| null | Set while paused. |
| `timer.session.pausedMs` | integer | Milliseconds in pauses that have ended. |
| `timer.session.elapsedSeconds` | integer | Active seconds at `generatedAt`. |
| `timer.session.paused` | boolean | `pausedAt != null`. |

Counters only:

| Field | Type | Meaning |
|---|---|---|
| `quickIncrements` | array of numbers | The buttons the app shows (`[1]`, `[1, 5]`). |

`nextReminders` items: `trackerId` (UUID), `time` (local `HH:mm`), `at` (instant). Only habits due today and not done, only times after `generatedAt`.

### Commitment

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | Its `id` in `trackers`. |
| `lockScreenName` | string | The neutral name ("Clear" unless chosen). The only name to show. |
| `clearSince` | instant | Time clear counts from here: the start, or the latest slip. Show `now - clearSince` ("2d 14h"). |
| `lampsPassed` | integer | Milestones passed at `generatedAt`. Lamps fall at 24 h, 48 h, 72 h, 120 h, 168 h, 240 h and 336 h after `clearSince`, then every 168 h; a lamp is passed exactly at its hour. |
| `nextLamp` | object | `at` (instant), `hours` (after `clearSince`) and a short `label` in the app's language (`"48h"`, `"5d"`). Past `at`, the next one is `hours` + the next step above. |
| `ownLines` | array of strings | His own lines, in his words, in order, each chosen by him to be seen on the lock screen; empty when he wrote none. The one shown at `now` is `ownLines[lampsPassed(now) % ownLines.length]`, with `lampsPassed` counted from `clearSince` as above, so it moves on at each lamp with or without the app. |
| `rideSeconds` | integer | How long an urge's ride lasts. An `urge_logged` not yet in a snapshot rides until its `at` + this. |
| `urgesRiddenOut` | integer | Every urge ever ridden out. Nothing resets it, a slip included. |
| `urgesToday` | integer | Urges logged on `day.date`. |
| `insteadHabits` | array | At most two timed habits to start instead, in the order chosen: `id` (a tracker in `trackers`), `lockScreenName` (string or null: show the icon), `icon`, `goalSeconds` (or null). Ones deleted, archived or no longer timers are left out. |
| `days` | array of 14 | The last fourteen days ending on `day.date`, oldest first: `{date, state}`, `state` one of `done` (no slip), `slip`, `not_counted` (before it existed). |

### A live clock without the app

Active milliseconds at any moment `now`:

```
end    = pausedAt ?? now
active = max(0, end - startedAt - pausedMs)
```

Seconds are `floor(active / 1000)`. Today's progress is `total + seconds`; with a `seconds` goal the day becomes done when that reaches `goal.seconds`, even before the app logs it. For an Android `Chronometer`, `base = SystemClock.elapsedRealtime() - active` while running, and stop it while paused.

### Working out today without the app

The app may not run after midnight. Compute "today" at render time from the phone's current clock and zone; if it is not `day.date` (or the clock is past `day.endsAt`), the snapshot is from an earlier day:

- `done` is false, `total` 0 and `reason` the not-done one for every tracker, except the commitment: its new day is `done`, `reason` `clear`, `total` 0. A session still running keeps running; the app gives its seconds to the days they happened on when it next runs.
- `sevenDays` and `commitment.days` move on by a day per day passed: the new day is `not_done` (`done` for the commitment), and the snapshot's `day.date` keeps the state it had. `commitment.urgesToday` is 0.
- `streak`: when `day.date` is yesterday, keep it if yesterday was `done` or was not due; set it to 0 if yesterday was due and not done. When `day.date` is older than yesterday, hide the streak until the app writes again.
- `dueToday` from `schedule`, for the new date `d`:
  - `{"type":"daily"}`: always.
  - `{"type":"weekdays","days":[1,2,3,4,5]}`: when `d`'s local day of week is in `days`, `0` = Sunday … `6` = Saturday.
  - `{"type":"every_n_days","interval":n,"anchorDate":"YYYY-MM-DD"}`: let `k` be the number of local calendar days from `anchorDate` to `d` (count calendar days; across a clock change local midnights are 23 or 25 hours apart, so round the hour difference, never floor it). Due when `k >= 0` and `k % n == 0`.
- Reminders for the new day: each `reminderTimes` entry of a due habit, as a local time on `d`. A time that does not exist that day (spring forward) fires an hour later.

## Timer

`modules/life-core/android/src/main/java/expo/modules/lifecore/TimerJson.kt`, `CoreTimerStateSchema` in `src/protocol/coreTimer.ts`. The one running or paused session; the file is absent when there is none. Native replaces it the same way as the snapshot (write `timer.json.tmp`, rename over `timer.json`) on every transition and every 30-second heartbeat while running, and deletes it when the session ends.

| Field | Type | Meaning |
|---|---|---|
| `sessionId` | UUID | Becomes the `id` of the session's `timer_session` line, so a session finished twice (a crash between the append and the delete) is logged once. |
| `trackerId` | UUID | The timed habit. |
| `name` | string | The real name. **Never show it on the lock screen.** |
| `lockScreenName` | string \| null | The neutral name; null shows "Timer" or the icon. |
| `iconKey` | string \| null | As the snapshot's `icon`. |
| `goal` | object | The goal in force at the start, as the snapshot's `timer.goal`. |
| `trackId` | string \| null | The bundled track playing, or null for the silent keepalive. |
| `loop` | boolean | The track loops until the session ends, or plays once. |
| `loggedSeconds` | integer | Seconds logged today before this session; the goal is reached at `goal.seconds - loggedSeconds` active seconds. |
| `startedAt` | instant | When it started. |
| `pausedAt` | instant \| null | Set while paused. |
| `pausedMs` | integer | Milliseconds in pauses that have ended. |
| `day` | local date | The app day it started on. |
| `goalReachedAt` | instant \| null | When the seconds goal was reached (the chime rang). |
| `heartbeatAt` | instant | Last moment a live process was running it. |

Active time is computed as in "A live clock without the app" below, with `pausedMs` for `pausedMs`. A process that has just started and finds a running session knows the process that ran it died (the timer service lives in the app's process): it treats the session as paused at `heartbeatAt` and writes that, so the dead time is never counted and the session stays resumable. A reader in a live process (the widget) never applies this rule; it reads the file as it is.

## Reminder plan

`src/protocol/reminderPlan.ts` (`ReminderPlanSchema`), read by `modules/life-core/.../reminders/ReminderPlan.kt`. Replaced atomically like the snapshot (`reminders.json.tmp`, then a rename) whenever what it holds changes, and once each time the app starts; after each write the app calls the module's `remindersChanged()`.

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. A reader that does not know it reminds of nothing. |
| `enabled` | boolean | The Habit reminders switch is on and notifications were allowed when it was written. False: no alarm, nothing posted. |
| `language` | `"en"` \| `"fr"` | The app's language (its setting, resolved). Every native notification (reminders, the timer) is worded in it; without a plan, in the phone's. |
| `habits` | array | Every habit not archived that has at least one reminder time; see below. |

Each habit: `id` (UUID, as in the snapshot), `name` (the real name: only in the notification's private version), `lockScreenName` (string or null), `schedule` (as the snapshot's), `reminderTimes` (local `HH:mm`, earliest first, once each; the habit's own times plus the one before its time window).

What native does with it:

- **One alarm.** An exact, allow-while-idle, wakeup (`RTC_WAKEUP`) alarm at the next moment any habit reminds at: each `reminderTimes` entry on each local date its `schedule` is due (as "Working out today without the app"; a time the spring change skips fires an hour later, one the autumn change repeats fires the first time). Re-armed after it goes off, after each `remindersChanged()`, and on boot, a clock or zone change and an app update. The cases are shared with the app in `modules/life-core/fixtures/reminder-moments.json`.
- **At the moment**, for each habit with a moment since the alarm was armed for (and within the last hour): post its reminder unless the widget's view of today (the snapshot, the overlay of queued lines and the day worked out without the app) says it is done, or its timer session is running or paused. A habit not in the snapshot is still to do.
- **The notification**: channel `life_core_reminders` ("Habit reminders", high importance), one per habit (tag = habit id). Private version "Habit reminder · Time for {name}"; public version (a locked phone that hides content) the same words with `lockScreenName`, or none when it is null, so the system shows its "contents hidden" line. Tapping opens the app. A check-off habit in the snapshot gets **Done**: the widget's tick (`habit_complete` through `WidgetActionReceiver`), sent without asking for the unlock first, and the reminder is cleared.
- Nothing is posted while the phone has notifications for the app turned off.

## Pending actions

`src/protocol/widgetActions.ts` (`WidgetActionSchema`). Native appends one line per widget tap (an urge logged or resolved is a tap too) and one per finished timer session to `widget/pending-actions.jsonl`; JavaScript drains it on start, on every `refreshFromDb()` (each return to the app, and each timer state change the module reports). Each action goes through the same store command a tap in the app uses, with all its rules: a habit tap only ever completes, never un-ticks; writes are abandoned if an import or clear replaced the data; a session that ran past midnight gives each day its own seconds and records the goal in force.

### Line format

One JSON object per line, UTF-8, ending in `\n` (0x0A), no other newlines inside. At most 1 KB a line.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | Format version. Other versions are skipped. |
| `id` | UUID | New for each tap (`UUID.randomUUID()`). The same id is never applied twice. |
| `at` | instant | When the tap happened, UTC. |
| `day` | local date | The app day on the phone at the tap (local calendar date in the phone's zone then). |
| `type` | string | One of the types below. |
| `trackerId` | UUID | A tracker `id` from the snapshot. Tracker lines only (`habit_complete`, `counter_add`, `timer_session`); urge lines have none. |
| `amount` | number | `counter_add` only: positive, at most 10000, usually one of `quickIncrements`. |

| `type` | Tracker | Effect |
|---|---|---|
| `habit_complete` | check-off habit | Marks `day` done if it is not already; never un-ticks. A timer habit ends in a `timer_session`. |
| `counter_add` | counter | Adds `amount` at `at`, on `day`. |
| `timer_session` | timer habit | A session native finished; fields below. Logs its seconds, each day getting the seconds that happened on it, with `goalSecondsInForce` recorded; with `markComplete` the day it ended on is marked done unless the session already made it done. |
| `urge_logged` | none | An urge, logged at `at` on `day`, open. The line's `id` becomes the urge's id. Its ride starts at `at` and lasts the commitment's `rideSeconds` (600 when there is none). |
| `urge_resolved` | none | Resolves the urge `urgeId` at `at` with `outcome`; fields below. |

`urge_resolved` fields (besides `v`, `id`, `at`, `day`, `type`; `id` is the line's own, new for each tap):

| Field | Type | Meaning |
|---|---|---|
| `urgeId` | UUID | The `id` of the `urge_logged` line that logged it. |
| `outcome` | `"used"` \| `"rode_out"` | The widget writes `"used"` ("Used" pressed). Nobody needs to write `"rode_out"`: JavaScript resolves an urge still open at the end of its ride as ridden out, at the ride's end, the next time it runs. |

An urge already resolved keeps its first outcome; a later `urge_resolved` for it is applied and changes nothing.

Example:

```
{"v":1,"id":"7a0e4c2d-1b3f-4e5a-9c6d-8f2e1a3b4c5d","at":"2026-03-10T21:04:12.000Z","day":"2026-03-10","type":"urge_logged"}
{"v":1,"id":"0b9d8c7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e","at":"2026-03-10T21:07:40.000Z","day":"2026-03-10","type":"urge_resolved","urgeId":"7a0e4c2d-1b3f-4e5a-9c6d-8f2e1a3b4c5d","outcome":"used"}
```

`timer_session` fields (besides `v`, `id`, `trackerId`, `type`; `at` is when it was finished and `day` the app day then):

| Field | Type | Meaning |
|---|---|---|
| `startedAt` | instant | When the session started. |
| `endedAt` | instant | When active time stopped: the start of the pause it was finished in, or `at`. |
| `pausedMs` | integer | Milliseconds paused between `startedAt` and `endedAt`. |
| `activeSeconds` | integer | `floor((endedAt - startedAt - pausedMs) / 1000)`; for the widget's overlay. |
| `goalSecondsInForce` | integer \| null | The seconds goal when the session started; null for a play-once or open goal. |
| `trackCompleted` | boolean | A play-once track ran to its end (this is what ended the session). |
| `markComplete` | boolean | Done was pressed: the day counts as done even short of the goal. A plain stop is false. |

A discarded session appends nothing.

Example:

```
{"v":1,"id":"6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11","at":"2026-03-10T08:12:03.418Z","day":"2026-03-10","type":"counter_add","trackerId":"550e8400-e29b-41d4-a716-446655441008","amount":1}
```

### Appending (native)

For each line:

1. `fd = Os.open(path, O_WRONLY | O_CREAT | O_APPEND, 0600)` on `files/widget/pending-actions.jsonl`. Open it for this one line; never keep it open.
2. Write the whole line, newline included, in one `write` call.
3. `Os.fstat(fd).st_ino` and `Os.stat(path).st_ino`, then close.
4. If `stat` failed or the two inode numbers differ, JavaScript renamed the file while this tap was being written, and the line may have landed in a queue that was already read. Go back to step 1 with **the same line, same id**. A line that did arrive twice is applied once.

Append only. Never rewrite, truncate, rename or delete either queue file.

### Draining (JavaScript)

1. If `pending-actions.draining.jsonl` exists, a drain died part-way: apply it first (step 3).
2. Otherwise, if `pending-actions.jsonl` exists, rename it to `pending-actions.draining.jsonl`. New taps from here on create a fresh `pending-actions.jsonl`.
3. Read the whole file. Text after the last newline is a line still being written or cut off; it is skipped (and counted), and the widget's step 4 writes it again if it was in flight. Each complete line that is not valid JSON, not version 1, not a known `type` or fails validation is skipped and counted; one bad line never stops the rest.
4. Apply each action in file order, except that every `urge_resolved` goes after the rest (a widget writing a log and its resolve in one burst may land them in either order; nothing else depends on a resolve), unless its id is in the applied log (the `widget_action_log` setting in SQLite, entries kept 30 days). Every action read ends up in the log, applied or dropped with its reason.
5. Delete `pending-actions.draining.jsonl`, then go back to step 1 once, for taps that arrived meanwhile.

Each action is applied at most once, by its id:

- `counter_add` becomes an event whose id is the action's id; inserting it again finds it already there.
- `habit_complete` is a no-op on a day already done.
- `timer_session` becomes events whose ids are derived from the action's id and the day (`derivedId` in `src/utils/id.ts`), one per day plus the Done mark; inserting them again finds them there.
- `urge_logged` inserts the urge under the line's id; inserting it again finds it there.
- `urge_resolved` only resolves an urge that is still open.

So every action is safe to repeat, and each is logged after it is applied. The log is what keeps an Undo standing: a Done mark removed by Undo is not put back by the same line arriving again. When the app itself finishes a session it applies the record at once and logs it; the copy native queued is then a duplicate.

If the app dies:

- after the rename, before any action: the next drain finds the draining file and applies it all.
- part-way through: actions already logged are skipped; one applied but not yet logged is found by its event ids and adds nothing.
- after the last action, before the delete: every action is in the log; the next drain skips them all and deletes the file.

### The widget's overlay

The widget (`modules/life-core/.../widget/WidgetToday.kt`) shows a tap before JavaScript applies it. It reads `pending-actions.draining.jsonl`, `pending-actions.jsonl` and the last lines its own process appended (which cover the moment between a drain deleting its file and the snapshot that follows), and counts each line, once by `id`, when its `at` is after the snapshot's `generatedAt`. Lines whose `day` is not today change no tracker; urge lines still start and end rides.

- `habit_complete` → that check-off is done.
- `counter_add` → `total` += `amount`, done once it reaches `target`.
- `timer_session` → `total` += `activeSeconds`; done with `markComplete`, `trackCompleted`, or a seconds goal reached.
- `urge_logged` → `urgesToday` + 1 (on its day); a ride from `at` for the commitment's `rideSeconds` (600 without one).
- `urge_resolved` → that ride ends, and is not counted as ridden out.

Any ride, from the snapshot or a line, that reached its end unresolved adds one to `urgesRiddenOut` on the widget, app or no app.

### Dropped actions

Read, logged with the reason, and not applied:

| Reason | When |
|---|---|
| `tracker_missing` | No tracker with that id (deleted). |
| `tracker_archived` | The tracker is archived. |
| `wrong_kind` | A counter action for a habit, a habit action for a counter, or `habit_complete` for a timer habit. |
| `not_a_timer` | A `timer_session` for a check-off habit. |
| `future_day` | `day` is after today on the phone (clock or zone changed). |
| `urge_missing` | An `urge_resolved` for an urge never logged (its `urge_logged` line was lost or cut off). |

An action for a day that has ended is applied to that day.

## The widget

`modules/life-core/android/src/main/java/expo/modules/lifecore/widget/`. One app widget, `widgetCategory="home_screen|keyguard"`, drawn natively from the snapshot, `timer.json` and the overlay above. It never opens SQLite and never writes the snapshot.

- Its buttons are broadcasts to `WidgetActionReceiver`, in the app's process and not exported. A tick appends `habit_complete`; a counter button `counter_add`; Urge `urge_logged`; "I used" `urge_resolved` with `outcome: "used"`; play, pause, resume, Done (`markComplete: true`) and discard go to the timer core, which appends the `timer_session` line as for any other finish. Play builds the core's start request from the snapshot tracker: `name`, `lockScreenName`, `icon`, `timer.goal`, `timer.trackId`, `timer.loop`, and today's seconds so far (the overlay included) as `loggedSeconds`.
- Each tap is checked against what is true when it lands, not what the widget showed: a tracker gone, a check-off already done, an amount that is not one of `quickIncrements`, a ride already over or another timer running makes it do nothing, and the same button twice within 0.7 s is one press.
- After a tap that queued a line the module emits `onQueueChange`, and a running app drains at once. With the app not running the line waits for the next drain; the overlay shows it meanwhile.
- On a locked phone (`OPTION_APPWIDGET_HOST_CATEGORY` includes keyguard) it shows lock-screen names, icons, numbers, the commitment's lock-screen name and the own line, never a tracker's `name`.
