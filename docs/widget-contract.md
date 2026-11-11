# Widget contract

What the JavaScript app writes for the lock-screen widget, and what the widget may write back. The native side (stage 6) is built against this file; the Zod schemas in `src/protocol/` are the same contract in code, and the two change together.

SQLite has one writer: the JavaScript app. The widget never opens the database. It reads the snapshot and appends to the pending-actions queue, nothing else.

## Location and encoding

Both files live in the app's private files directory, in a `widget` folder:

| File | Path on the phone | Written by | Read by |
|---|---|---|---|
| Snapshot | `File(context.filesDir, "widget/snapshot.json")` | JavaScript | widget |
| Pending actions | `File(context.filesDir, "widget/pending-actions.jsonl")` | widget (append) | JavaScript |

`context.filesDir` is `/data/user/0/<package>/files` (`com.lifeapp.dashboard`, or `com.lifeapp.dashboard.dev` for the dev build). The folder may not exist before the app's first write; create it if the widget writes first.

Text is UTF-8 with no byte order mark. Instants are ISO-8601 in UTC with milliseconds and a `Z` (`2026-03-10T08:32:00.500Z`). Local dates are `YYYY-MM-DD` and local clock times `HH:mm`, both in the zone named by `day.timeZone`.

## Snapshot

`src/protocol/widgetSnapshot.ts` (`WidgetSnapshotSchema`). One JSON object: 3.7 KB for seven habits and two counters.

### When it is written

After any change to what it shows (a tick, a counter tap, a timer start, pause, resume, stop or Done, an edit, an archive, a delete, a reorder, a day rollover), and after every `refreshFromDb()` (each time the app comes to the front). Changes within 500 ms of the first share one write. A timer's 30-second heartbeat alone does not cause a write: the session fields below let the widget run the clock itself.

### Atomic replace

The app writes `widget/snapshot.json.tmp`, then renames it over `widget/snapshot.json` (`java.io.File.renameTo`, a rename(2) in one directory). A reader that opens `snapshot.json` gets either the previous complete file or the new complete file. Read the whole file in one go and parse it; never read `snapshot.json.tmp`. If the file is missing or does not parse, show nothing rather than guess.

### Fields

| Field | Type | Meaning |
|---|---|---|
| `version` | `1` | Format version. A reader that does not know the version shows nothing. |
| `generatedAt` | instant | When the file was built. |
| `day.date` | local date | The app day described. The app day is the local calendar day; it turns at local midnight. |
| `day.endsAt` | instant | The next local midnight. From then on the per-day fields below (`done`, `reason`, `total`, `streak`, `nextReminders`) describe yesterday. |
| `day.timeZone` | string | IANA zone of the phone at `generatedAt` (`Europe/Paris`). |
| `day.utcOffsetMinutes` | integer | Offset from UTC at `generatedAt`, minutes east (Paris: 60 in winter, 120 in summer). |
| `trackers` | array | Every tracker on Home (archived ones are left out), in Home's order. |
| `nextReminders` | array | Reminders still to come today, earliest first; see below. |

Each tracker:

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | The tracker. Use it in pending actions. |
| `kind` | `"habit"` \| `"counter"` | |
| `name` | string | The real name. **Never show it on the lock screen.** |
| `lockScreenName` | string \| null | The neutral name for a locked phone, at most 20 characters. Null: show the icon only. Counters always have null. |
| `icon` | string \| null | A MaterialCommunityIcons glyph name (`meditation`, `pill`, `water`…), or one of the app's own: `push-up`, `pull-up`. Null: no icon chosen. |
| `dueToday` | boolean | Scheduled on `day.date` (see `schedule`). Counters are always due. A habit with a time window is due all day; `visibleOnlyInTimeRange` says whether the app hides it outside the window. |
| `done` | boolean | The day counts as done. |
| `reason` | string | Why. One of `checked`, `not_checked` (check-off habit); `target_met`, `under_target` (seconds goal or counter target); `track_finished`, `track_not_finished` (timer that plays a track once); `time_logged`, `nothing_logged` (timer with no goal); `marked_complete` (Done pressed before the goal); `no_target` (counter with no target, never done); `running_past_goal` (a timer still running has passed its seconds goal; its seconds are not logged yet). |
| `total` | number | Logged today, in `unit`. A running session's seconds are not in it. |
| `target` | number \| null | The amount that finishes the day, in `unit`. Null when there is none. |
| `streak` | integer | Days in a row done, ending today if today is done, else yesterday. |
| `schedule` | object | See "Working out today without the app". Counters: `{"type":"daily"}`. |
| `reminderTimes` | array of `HH:mm` | Local times this tracker reminds at on a due day, earliest first. Counters: empty. |
| `unit` | string | Habits: `"ticks"` (check-off) or `"seconds"` (timer). Counters: their own unit text (`"glasses"`). |

Habits only:

| Field | Type | Meaning |
|---|---|---|
| `trackingMode` | `"boolean"` \| `"timer"` | Check-off or timer. |
| `timeRange` | `{start, end}` \| null | Local `HH:mm` window. |
| `visibleOnlyInTimeRange` | boolean | The app hides the habit outside `timeRange`. |
| `timer` | object \| null | Null for check-off habits. |
| `timer.goal` | object | `{"type":"seconds","seconds":900}`, `{"type":"play_once","trackSeconds":912}` (done when the track ends; the widget cannot play it) or `{"type":"open"}` (done once any time is logged). |
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

### A live clock without the app

Active milliseconds at any moment `now`:

```
end    = pausedAt ?? now
active = max(0, end - startedAt - pausedMs)
```

Seconds are `floor(active / 1000)`. Today's progress is `total + seconds`; with a `seconds` goal the day becomes done when that reaches `goal.seconds`, even before the app logs it. For an Android `Chronometer`, `base = SystemClock.elapsedRealtime() - active` while running, and stop it while paused.

### Working out today without the app

The app may not run after midnight. Compute "today" at render time from the phone's current clock and zone; if it is not `day.date` (or the clock is past `day.endsAt`), the snapshot is from an earlier day:

- `done` is false, `total` 0 and `reason` the not-done one for every tracker. A session still running keeps running; the app gives its seconds to the days they happened on when it next runs.
- `streak`: when `day.date` is yesterday, keep it if yesterday was `done` or was not due; set it to 0 if yesterday was due and not done. When `day.date` is older than yesterday, hide the streak until the app writes again.
- `dueToday` from `schedule`, for the new date `d`:
  - `{"type":"daily"}`: always.
  - `{"type":"weekdays","days":[1,2,3,4,5]}`: when `d`'s local day of week is in `days`, `0` = Sunday … `6` = Saturday.
  - `{"type":"every_n_days","interval":n,"anchorDate":"YYYY-MM-DD"}`: let `k` be the number of local calendar days from `anchorDate` to `d` (count calendar days; across a clock change local midnights are 23 or 25 hours apart, so round the hour difference, never floor it). Due when `k >= 0` and `k % n == 0`.
- Reminders for the new day: each `reminderTimes` entry of a due habit, as a local time on `d`. A time that does not exist that day (spring forward) fires an hour later.

## Pending actions

`src/protocol/widgetActions.ts` (`WidgetActionSchema`). The widget appends one line per tap to `widget/pending-actions.jsonl`; JavaScript drains it on start, on every `refreshFromDb()` (each return to the app) and, from stage 6, on the widget's broadcast. Each action goes through the same store command a tap in the app uses, with all its rules: a habit tap only ever completes, never un-ticks; writes are abandoned if an import or clear replaced the data; a timer stopped after midnight gives each day its own seconds and records the goal in force.

### Line format

One JSON object per line, UTF-8, ending in `\n` (0x0A), no other newlines inside. At most 1 KB a line.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | Format version. Other versions are skipped. |
| `id` | UUID | New for each tap (`UUID.randomUUID()`). The same id is never applied twice. |
| `at` | instant | When the tap happened, UTC. |
| `day` | local date | The app day on the phone at the tap (local calendar date in the phone's zone then). |
| `type` | string | One of the types below. |
| `trackerId` | UUID | A tracker `id` from the snapshot. |
| `amount` | number | `counter_add` only: positive, at most 10000, usually one of `quickIncrements`. |

| `type` | Tracker | Effect |
|---|---|---|
| `habit_complete` | check-off habit | Marks `day` done if it is not already; never un-ticks. A timer habit is finished with `timer_done`. |
| `counter_add` | counter | Adds `amount` at `at`, on `day`. |
| `timer_start` | timer habit | Starts a session now (stopping any other running timer, as the app does), or resumes a paused one. |
| `timer_pause` | timer habit | Pauses the running session. |
| `timer_resume` | timer habit | Resumes the paused session. |
| `timer_done` | timer habit | Stops the session, logs its seconds and marks the day done even short of the goal. With no session, marks the day done. |
| `timer_discard` | timer habit | Stops the session and logs nothing. |

Example:

```
{"v":1,"id":"6f1c2a9e-8d3b-4c55-9a1e-2b7d4e0f9c11","at":"2026-03-10T08:12:03.418Z","day":"2026-03-10","type":"counter_add","trackerId":"550e8400-e29b-41d4-a716-446655441008","amount":1}
```

### Appending (native)

For each tap:

1. `fd = Os.open(path, O_WRONLY | O_CREAT | O_APPEND, 0600)` on `files/widget/pending-actions.jsonl`. Open it for this one line; never keep it open.
2. Write the whole line, newline included, in one `write` call.
3. `Os.fstat(fd).st_ino` and `Os.stat(path).st_ino`, then close.
4. If `stat` failed or the two inode numbers differ, JavaScript renamed the file while this tap was being written, and the line may have landed in a queue that was already read. Go back to step 1 with **the same line, same id**. A line that did arrive twice is applied once.

Append only. Never rewrite, truncate, rename or delete either queue file.

### Draining (JavaScript)

1. If `pending-actions.draining.jsonl` exists, a drain died part-way: apply it first (step 3).
2. Otherwise, if `pending-actions.jsonl` exists, rename it to `pending-actions.draining.jsonl`. New taps from here on create a fresh `pending-actions.jsonl`.
3. Read the whole file. Text after the last newline is a line still being written or cut off; it is skipped (and counted), and the widget's step 4 writes it again if it was in flight. Each complete line that is not valid JSON, not version 1, not a known `type` or fails validation is skipped and counted; one bad line never stops the rest.
4. Apply each action in file order, unless its id is in the applied log (the `widget_action_log` setting in SQLite, entries kept 30 days). Every action read ends up in the log, applied or dropped with its reason.
5. Delete `pending-actions.draining.jsonl`, then go back to step 1 once, for taps that arrived meanwhile.

Each action is applied at most once, by its id:

- `counter_add` becomes an event whose id is the action's id; inserting it again finds it already there. It is logged after it is applied.
- `habit_complete` is a no-op on a day already done. It is logged after it is applied.
- Timer actions are not safe to repeat (a second `timer_start` after `timer_done` would start a new session), so they are logged **before** they are applied.

If the app dies:

- after the rename, before any action: the next drain finds the draining file and applies it all.
- part-way through: actions already logged are skipped; a counter tap applied but not yet logged is found by its event id; a timer tap logged but not yet applied is lost (at most one tap, never applied twice).
- after the last action, before the delete: every action is in the log; the next drain skips them all and deletes the file.

### Dropped actions

Read, logged with the reason, and not applied:

| Reason | When |
|---|---|
| `tracker_missing` | No tracker with that id (deleted). |
| `tracker_archived` | The tracker is archived. |
| `wrong_kind` | A counter action for a habit, a habit action for a counter, or `habit_complete` for a timer habit. |
| `not_a_timer` | A timer action for a check-off habit. |
| `day_ended` | A timer action whose `day` is before today: a session runs on today's clock, so the tap means nothing now. `habit_complete` and `counter_add` for an ended day are applied to that day. |
| `future_day` | `day` is after today on the phone (clock or zone changed). |
