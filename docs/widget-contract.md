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

Specified in the next stage of this document (`src/protocol/widgetActions.ts`).
