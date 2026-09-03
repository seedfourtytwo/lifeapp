# Insights — inventory before redesign

Insights is being re-architected. The order is **decide what data to display first, then how to display it**.

This document is the factual input to that design session: what the screen is today, what data the app actually holds, what already works and should be reused, and what any redesign is bound by. **It deliberately does not propose a redesign, pick chart types, or choose a narrative.** Those are the owner's calls; the open questions at the end are the forks.

Every claim below carries a `file:line` that was read. Where something could not be verified it says so.

Related: [roadmap.md](./roadmap.md) ("Insights content redesign (not just chrome)", line 58), [protocol-plan.md](./protocol-plan.md), rules `project-architecture.mdc`, `.claude/rules.md`.

---

## 1. What Insights is today

Registered as a stack screen, reached from More: `src/navigation/AppNavigator.tsx:70`.

| File | Lines | Role |
|------|-------|------|
| `src/screens/InsightsScreen.tsx` | 669 | The whole screen: load, controls, chart, day panel |
| `src/components/InteractiveDailyChart.tsx` | 366 | Hand-rolled SVG chart, shared with Tracker History |
| `src/utils/chartStats.ts` | 118 | Pure aggregation + the range/series constants |
| `src/utils/insightsColors.ts` | 12 | Five hardcoded hex series colours |

No chart library is installed. The only drawing dependency is `react-native-svg` 15.12.1 (`package.json:48`); the chart is `Svg` / `Line` / `Rect` / `Polyline` / `Circle` composed by hand (`InteractiveDailyChart.tsx:3`).

### The three control clusters

| Control | Where | Behaviour |
|---------|-------|-----------|
| Range | `InsightsScreen.tsx:324-335` | `SegmentedButtons` over `HISTORY_RANGES = [7, 30, 90]` (`chartStats.ts:114`), default 30 (`chartStats.ts:116`) |
| Tracker chips | `InsightsScreen.tsx:337-388` | Toggle series; capped at `INSIGHTS_MAX_SERIES = 5` (`chartStats.ts:118`), enforced at `:211`. Over cap, unselected chips go `disabled` + `opacity: 0.45` (`:369`) |
| Weather | `InsightsScreen.tsx:390-407` | A Paper `Switch` in a `Pressable` (`accessibilityRole="switch"`), overlays daily max temp |

Defaults: first two active trackers auto-selected (`:115`); selected day defaults to today (`:134-137`).

### The confirmed root cause

`normalizeSeriesToUnit` scales every series against **its own** maximum:

```ts
/** Normalize each series to 0–1 against its own max in range (min floor 1). */
export function normalizeSeriesToUnit(
  seriesValues: readonly (readonly number[])[],
): number[][] {
  return seriesValues.map((values) => {
    const max = Math.max(...values, 1);
    return values.map((v) => v / max);
  });
}
```
— `src/utils/chartStats.ts:21-29`

Insights calls it unconditionally on every selected series before plotting (`InsightsScreen.tsx:228`).

The consequence, stated plainly: **a multi-series Insights chart plots unitless 0–1 curves that cannot be compared to each other.** A habit that was done once in 30 days and a counter that peaked at 400 both touch the top of the plot. The y-axis has no ticks and no unit label because there is no unit it could carry. Toggling a fourth tracker on does not fix this — it adds a fourth incomparable curve.

Two aggravating details:

- The weather overlay is normalised the same way, against its own separate `weatherMax` (`InteractiveDailyChart.tsx:83-88`, plotted at `:115`). So the temperature line is a *third* scale on the same 168px box.
- The chart's own `yMax` (`:75-90`) is therefore always ≈1 in the Insights path, and the per-bar numeric labels are suppressed whenever `multi` is true (`:121`) — the screen knows the numbers are meaningless and hides them.

Single-series is a different, working chart: bars, real values, a moving-average line and a unit-labelled footer. That path is Tracker History, not Insights.

### Two screens, one chart — the key constraint

`InteractiveDailyChart` has exactly two consumers:

- `src/screens/InsightsScreen.tsx:415-426` — N series, normalised, no MA, optional weather overlay, `dense` when range > 14
- `src/screens/TrackerHistoryScreen.tsx:345-363` — one series with raw plot values + `completed` flags, `movingAverage`, unit footer

They exercise disjoint halves of the component (`multi` branch at `:167-199` vs `!multi` bar branch at `:138-165`). **Any change to the chart's props or geometry lands on Tracker History too.** A redesign that forks the component, or that moves Insights to something new, must state what happens to Tracker History rather than leave it as a side effect.

---

## 2. Data inventory — what the app actually holds

Every persisted table is declared once in `src/db/persistedConcepts.ts`; DB schema is at v21 (`src/db/migrations.ts:24`). The list below is that file's concept list, read for what each could feed.

Density verdicts are about *shape*, not about this user's particular database, which is not inspectable from here.

### 2.1 `events` — the only real time series

| | |
|---|---|
| Table | `events(id, element_id, timestamp, date, value, meta_json, protocol_version)` — `persistedConcepts.ts:179-192` |
| Indexes | `(element_id, date)` and `(date)` — `:191-192` |
| Repository | `src/db/repositories/eventRepository.ts` |
| Granularity | One row per logging action, with a wall-clock `timestamp` **and** a separate local `date` |
| Back to | Install / first log. Append-only, never trimmed except by an explicit Clear (`:193-198`) |

Aggregation helpers that already exist:

| Helper | Line | Shape |
|--------|------|-------|
| `getDailyTotalsForElementsSince` | `:236` | `Map<elementId, {date, total}[]>` — one grouped SQL query, `SUM(value) GROUP BY element_id, date`. The workhorse Insights uses (`InsightsScreen.tsx:121`) |
| `getDailyTotalsByElement` | `:136` | Same, one element — Tracker History |
| `getDailyTotalsForElementsOnDate` | `:210` | Single-day totals |
| `getEventsForElementsSince` | `:121` | Raw rows, meta included |
| `getAllEvents` | `:262` | Everything, ordered by timestamp |

**Daily aggregation is `SUM(value)` per element per date** — the rule is documented in `src/protocol/semantics.ts:6-16`. What `value` means depends on the kind:

| kind | config | `event.value` | typical `meta.source` |
|------|--------|---------------|------------------------|
| counter | — | increment, or a set total | `quick_button`, `manual`, `manual_set` (`kinds/counter.ts:21-24`) |
| habit | `trackingMode: 'boolean'` | 1 = checked off | `habit_tick` |
| habit | `trackingMode: 'timer'` | session length in **seconds** | `timer_session` |

`chartPlotValue` (`semantics.ts:61-71`) is the display conversion: counter → raw; timer habit → seconds ÷ 60, rounded to minutes; boolean habit → 1/0 by `isHabitDayComplete`. `chartUnitLabel` (`:52-58`) gives the axis unit (`min`, `done`, or the counter's own `unit` string).

**The timer meta is the richest untouched thing in the database.** `HabitEventMetaSchema` (`src/protocol/kinds/habit.ts:73-85`):

```
{ source: 'timer_session', startedAt: ISO datetime, endedAt: ISO datetime,
  durationSeconds: number, trackCompleted?: boolean }
```

That is a per-session record with real start and end wall-clock times. **Nothing in Insights reads it today** — the screen only ever sees the daily SUM. Time-of-day, session length distribution, sessions-per-day and session-vs-target are all computable from data already on disk with no schema change.

*Density:* dense and chart-worthy for any tracker the user actually logs. **Misleading-graph risk:** a boolean habit's daily total is 1 or 0 — plotting it as a line, or averaging it with anything, produces a shape that looks like a trend and is not one. Timer seconds and counter counts live in completely different numeric ranges (see §1).

### 2.2 `elements` and tracker config — the metadata that gives events meaning

| | |
|---|---|
| Table | `elements(id, kind, name, config_json, protocol_version, created_at, archived_at)` — `persistedConcepts.ts:141-150` |
| Repository | `src/db/repositories/elementRepository.ts` (`getAllElements:32`, `getElementCreatedAt:51`) |

Config fields available for framing a number:

| Field | Where | Use |
|-------|-------|-----|
| `trackingMode` (`boolean` \| `timer`) | `kinds/habit.ts:53` | Decides the unit and whether a session exists at all |
| `schedule` | `kinds/habit.ts:55`, `protocol/schedule.ts` | Which days *should* have a value — the difference between a miss and a rest day |
| `dailyTargetSeconds` | `kinds/habit.ts:60` | Timer target; drives `isHabitDayComplete` (`:162-167`) |
| `targetLabel` | `kinds/habit.ts:56` | User's own wording for the goal |
| `dailyTarget` (counter) | `kinds/counter.ts:12` | Counter target; drives completion (`semantics.ts:41-44`) |
| `unit` (counter) | `kinds/counter.ts:8` | The only real unit string in the system |
| `created_at` | `elements` | Earliest honest x-axis start for that tracker (`createdOnLocalDate` already exists for this) |
| `archived_at` | `elements` | **Insights filters archived trackers out entirely** (`InsightsScreen.tsx:109`) |

**A target is the missing denominator.** Everything the current chart lacks — a comparable y-axis, a meaningful 0–100% — exists as config for any tracker that has a target set. Trackers with no target have no denominator, and nothing can invent one.

*Density:* always present, one row per tracker. Not a series; it is the frame.

*Flag:* archived trackers vanish from Insights but their events remain in the table. "Last 90 days" silently excludes a habit archived last week.

### 2.3 Streaks — computed, never stored

| Helper | File | Computes |
|--------|------|----------|
| `computeStreak` | `src/utils/streak.ts:11` | Consecutive **scheduled** days completed, ending today or yesterday; ignores days before `createdOn` |
| `computeFailureStreak` | `src/utils/streak.ts:48` | Consecutive scheduled days missed; 0 when today is done |
| `computeHabitStreaksFromEvents` | `src/utils/habitStreakCompute.ts:24` | For habits whose completion needs event meta |
| `computeHabitStreaksFromDailyTotals` | `src/utils/habitStreakCompute.ts:39` | For everything else |
| `completedDatesFromCounterDailyTotals` | `src/utils/counterStreakCompute.ts:5` | Target-hit days for a counter |
| `computeCounterTargetStreak` | `src/utils/counterStreakCompute.ts:18` | Counter target-hit streak |
| `computePersonalBestStreak` | `src/utils/chartStats.ts:73` | Longest ever, schedule-aware |

Loaded in bulk by `loadHabitStreakMaps` (`src/store/habitStreakFetch.ts:33`) and `loadCounterStreakMaps` (`src/store/counterStreakFetch.ts:15`), both over a **365-day** window (`STREAK_LOOKBACK_DAYS`, `src/utils/dates.ts:5`, via `streakHistorySinceDate:14`).

*Density:* one integer per tracker — a stat, not a series. Cheap and already correct, including the schedule-aware skip logic that a naive "consecutive dates" count would get wrong.

*Note:* the roadmap already lists "Counter target-hit streak in History / Insights (Home cache is not stats)" as a leftover (`roadmap.md:57`). Insights shows no streak at all today.

### 2.4 `day_notes` — per-tracker, per-day text

| | |
|---|---|
| Table | `day_notes(id, element_id, date, body, updated_at, …)`, `UNIQUE(element_id, date)` — `persistedConcepts.ts:203-215` |
| Repository | `src/db/repositories/dayNoteRepository.ts` |

Queries that matter for a chart:

| Helper | Line |
|--------|------|
| `getNotesForElementsOnDate` | `:73` — used by the Insights day panel |
| `getNotesForElementInRange` | `:57` — used by Tracker History |
| `getDatesWithTrackerNotes` | `:123` — **`SELECT DISTINCT date` for a set of elements. This is exactly the query a "this day has a note" marker needs, and it already exists.** |
| `getDatesWithTrackerNotesOnly` | `:99` — same, excluding days that also have a journal |

*Density:* sparse by nature and that is fine — a note is an **annotation**, not a series. Counting notes per week and plotting it would be a misleading graph: it measures how chatty the user felt, not anything about the tracker.

*Privacy:* the body is private user text. Presence, date and length are structural; the content belongs on screen only when the user opens that day.

### 2.5 `daily_journals` + `journal_notebooks`

| | |
|---|---|
| Tables | `daily_journals(id, notebook_id, date, body, created_at, updated_at, …)`, `UNIQUE(notebook_id, date)` — `persistedConcepts.ts:256-272`; `journal_notebooks(id, name, color, icon, sort_order, …)` — `:228-238` |
| Repository | `src/db/repositories/dailyJournalRepository.ts` |
| Helpers | `getJournalsForDate:61`, `getNotebookIdsWithJournalsOnDate:90` (already filters `length(trim(body)) > 0`), `getAllJournals:102` |
| Store | `src/store/journalNotebookStore.ts` |

Multiple notebooks per day are possible (one entry per notebook per day). **Insights only ever shows the first**: it reads `entries[0]` and `notebooks[0]` (`InsightsScreen.tsx:183-188`). On a multi-notebook day the panel silently shows one of them.

*Density:* sparse and optional. Same verdict as day notes — annotation, not series. There is no per-day index equivalent to `getDatesWithTrackerNotes` for journals; `getNotebookIdsWithJournalsOnDate` is per-date, so a range query would need writing.

### 2.6 `todos`

| | |
|---|---|
| Table | `todos(id, title, note, due_date, sort_order, created_at, completed_at, …)` — `persistedConcepts.ts:348-362` |
| Indexes | `completed_at`, `due_date` — `:361-362` |
| Repository | `src/db/repositories/todoRepository.ts` (`getOpenTodos:54`, `getCompletedTodos:79`, `getAllTodos:48`) |
| Screen | `src/screens/TodoHistoryScreen.tsx` |

`completed_at IS NULL` means open; set means done. **Completed rows are never deleted** — the DDL comment says so explicitly (`persistedConcepts.ts:355-357`), and they are browsable in Todo history. `getCompletedTodos` already supports a date filter (`date(completed_at, 'localtime') = ?`, `:96`) and free-text search.

*Density:* an unbounded completion log with real timestamps, going back to install. Genuinely chartable as "tasks finished per day/week" **if** the user uses todos. It is app data, not a protocol kind (`roadmap.md`, Todos row) — mixing it into a tracker chart would blur the class boundary that `protocol-plan.md` insists on.

*Flag:* `due_date` is nullable and optional by design. Anything like "on-time completion rate" would be computed over a self-selected subset and would be misleading.

### 2.7 Nutrition — `food_items` + `food_log`

| | |
|---|---|
| Tables | `food_items(… slug, name, food_group, counts_as_plant, diversity_key, nutrients_json, glycemic_index, portions_json …)` — `persistedConcepts.ts:286-304`; `food_log(id, food_id, date, logged_at, …)` with `UNIQUE(food_id, date)` — `:323-335` |
| Repository | `src/db/repositories/foodRepository.ts` (`getFoodLogForDates:231`, `getAllFoodLog:244`, `getActiveFoodItems:101`) |
| Aggregation | `computeWeekDiversity` — `src/nutrition/weekDiversity.ts:32` |
| Store | `src/store/foodStore.ts` (loads by `weekDates(weekStart)`, `:56`, `:105`) |

`computeWeekDiversity` returns `plantCount`, `totalCount`, `target`, `remaining`, `progress` (0–1, clamped) and the id sets. Counting is by `diversityKey`, so two varieties of one plant count once (`weekDiversity.ts:48-52`). Target is `WEEKLY_PLANT_TARGET = 30` (`src/protocol/food.ts:48`). Weeks are Monday-first (`startOfWeekDate`, `src/utils/dates.ts:53`; `weekDates:62`).

**Two hard limits that rule out nutrient maths today:**

1. The catalog ships empty. `src/nutrition/seed/foods.json` has `items: []` — verified, zero entries. Every food in a user's database was typed in by hand, so nutrient fields are populated only where that user bothered.
2. **Amounts do not exist.** `food_log` is one row per food per day with no quantity column; the DDL comment states it outright: *"v1 tracks 'did I eat this', not how much"* (`persistedConcepts.ts:330-331`). A nullable quantity column is a future roadmap item (`roadmap.md`, Nutrition next steps #2), and #3 explicitly gates intake maths/graphs on it.

*Density:* the **weekly plant count is a real, well-defined, already-computed number with a target** — arguably the single cleanest metric in the app, because it is the only one that ships with its own denominator. Everything else nutritional (calories, macros, GI, glycemic load) is **not available** and must not be charted. Plotting per-day distinct-food counts as a proxy for "how well I ate" would be misleading: it counts variety, not quantity or quality.

### 2.8 `weather_daily`

| | |
|---|---|
| Table | `weather_daily(date PK, temp_c, temp_min_c, temp_max_c, weather_code, condition, precip_probability, lat, lon, fetched_at)` — `persistedConcepts.ts:413-424` |
| Repository | `src/db/repositories/weatherRepository.ts` (`getWeatherDailyInRange:78`) |
| Backfill | `src/weather/ensureWeatherDailyRange.ts:23` |
| Backup | **`bundleKey: null`** — `persistedConcepts.ts:428`, with the comment *"Re-fetched from the network, so a backup would only carry stale numbers."* |

`ensureWeatherDailyRange` finds missing dates in the range (`:31-34`), returns early if no location is configured (`:38-39`), fetches from Open-Meteo, and **soft-fails on any error** with a `console.warn` (`:78-83`). Insights already calls it fire-and-forget for the visible range (`InsightsScreen.tsx:139-147`).

*Density:* **structurally sparse and not to be trusted as a continuous series.** History depends on the user having had a location set, having been online, and Open-Meteo's own archive depth — none of which is guaranteed for any particular day. It survives a device migration only by being re-fetched, so a restored backup starts with an empty table. The chart already handles nulls by skipping the point (`InteractiveDailyChart.tsx:113`), which means a gappy overlay draws a straight line across the gap and looks like data.

*Flag:* this is the strongest candidate for a misleading graph in the whole inventory. A weather line laid over a habit line invites a causal read from a correlation the data cannot support — one location, one number per day, gaps that render invisibly, and n = at most 90 in the widest range.

### 2.9 Calendar

| | |
|---|---|
| Tables | `calendars`, `calendar_events`, `calendar_reminders`, `calendar_occurrence_clears` — `persistedConcepts.ts:438-481` |
| Domain | `src/calendar/` — `occurrences.ts`, `rrule.ts`, `attention.ts`, `dates.ts` |
| Repository | `src/db/repositories/calendarRepository.ts` |
| Store | `src/store/calendarStore.ts` — `occurrencesInRange(start, end):343`, `attentionOccurrences(limit, withinDays):346` |

Occurrence expansion (recurrence → concrete dated instances) is centralised in the store; per-occurrence "done" is a row in `calendar_occurrence_clears`. `attentionOccurrences` defaults to a forward-looking 90 days.

*Density:* events are stored as rules plus expansion, so a **past** range expands as cleanly as a future one — the data is there. But calendar is explicitly **ambient**, not a tracker (`calendar-plan.md` first line; `protocol-plan.md` three-classes table). It answers "what was on that day", which is context for a selected day, not a series.

*Flag:* "busy days" as a plotted metric would be counting how diligently the user enters calendar events, not how busy they were.

### 2.10 `app_settings` — ambient, not measurement

| | |
|---|---|
| Table | `app_settings(key PK, value)` — `persistedConcepts.ts:402-405`; cleared only by the `preferences` ambient toggle (`:406`) |
| Schema | `src/protocol/appSettings.ts` — `AppSettingsSchema:85`, `APP_SETTING_KEYS:96` |

Holds: `themeMode`, `appLanguage`, `eveningCheckInEnabled` / `eveningCheckInTime` (both parked — no UI, no scheduler, `appSettings.ts:70-73`), `weatherWidgetEnabled`, `weatherLocationMode`, `weatherPlaceName`, `weatherLat`, `weatherLon`.

*Density:* current values only — **no history at all**, key/value with no timestamp. Its use to Insights is as a gate, not as data: `weatherLat`/`weatherLon` decide whether a weather overlay can exist (`ensureWeatherDailyRange.ts:9-17`), `appLanguage` and `themeMode` decide formatting and palette.

Also worth knowing: `activeTimerRepository.ts` stores live timer sessions under the `active_timer_sessions` key (`:6`) — transient runtime state for a running timer, not history.

### 2.11 Not available

For completeness, so the design session does not plan around something that does not exist:

- **Mood, energy, sleep, weight** — no table, no kind. Would be a new tracker or a new concept.
- **Nutrient / calorie intake** — see §2.7. Blocked on amounts.
- **Skip days / "rest day" as distinct from a miss** — schedule says *should*, but there is no explicit skip. Listed as a competitor gap (`competitor-inspiration.md:24`), not built.
- **Habit strength / EMA score** — same, not built. And `project-architecture.mdc` is explicit that derived scores stay computed rather than stored.
- **Location history** — one lat/lon in settings, not per-day.
- **Any per-day setting/theme history** — `app_settings` is current-value only.

### Density summary

| Source | Real granularity | Chart-worthy? |
|--------|------------------|---------------|
| `events` (counter) | Per action, summed per day | Yes — has a unit, often a target |
| `events` (timer habit) | Per session, with start/end/duration | Yes, and richer than what is plotted today |
| `events` (boolean habit) | 1/0 per day | As a calendar-style hit/miss, **not** as a line |
| Timer session meta | Per session, wall-clock | Yes — completely unused today |
| Tracker config / targets | Static | Frame, not series — supplies the missing denominator |
| Streaks | One integer per tracker | Stat, not series |
| `day_notes` | Sparse, per element per day | Annotation only |
| `daily_journals` | Sparse, per notebook per day | Annotation only |
| `todos` completions | Per completion, unbounded history | Yes, if the user uses todos — but a different data class |
| Weekly plant count | Per Mon–Sun week, target 30 | Yes — the cleanest metric in the app |
| Nutrient intake | — | **Not available.** No amounts, empty catalog |
| `weather_daily` | One row per fetched day, gappy | Overlay at best; correlation trap |
| Calendar occurrences | Expanded from rules, any range | Day context, not a metric |
| `app_settings` | Current value only | Gate, not data |

---

## 3. Already built — reuse, do not rebuild

### The day panel is a working day view

Select a day on the chart and `InsightsScreen` already:

| Behaviour | Lines |
|-----------|-------|
| Loads that date's journal entries and the notebook list | `:172-188` (`getJournalsForDate`, `journalNotebookStore.load()`) |
| Loads per-tracker day notes for the selected trackers | `:178-181` (`getNotesForElementsOnDate`) |
| Renders a journal row — icon reflects presence, preview truncated to 120 chars | `:433-464` |
| Renders per-tracker rows: colour swatch, name, formatted day value, note preview | `:471-514` |
| Opens the journal editor | `openJournal:256-268` |
| Opens the tracker-note editor | `openTrackerNote:249-254` |
| Writes the saved body straight back into local state, no reload | `noteEditor.onSaved:81-94` |
| Skips the focus reload while the editor is open, so typing is not interrupted | `:96-97`, `:156-161` |
| Mounts the editor | `<NoteEditorHost session={noteEditor} />` — `:270`, rendered at `:284`, `:297`, `:313`, `:546` |

So the idea of *"note icons on graph data points that open that day's note"* is **mostly already built.** What is missing is one thing: **a per-day has-a-note marker on the chart itself.** `InteractiveDailyChartProps` (`InteractiveDailyChart.tsx:34-46`) has no notes input; `days` is `{ date, label }` only (`:14-17`).

And the query for it exists: `getDatesWithTrackerNotes(db, elementIds)` (`dayNoteRepository.ts:123`) returns exactly the distinct dates needed. A journal equivalent for a date range does not exist and would need writing — `getNotebookIdsWithJournalsOnDate` (`dailyJournalRepository.ts:90`) is single-date.

> I could not find the phrase "note icons on graph data points" in `.cursor/roadmap.md`, `product-ideas.md` or `competitor-inspiration.md`. The roadmap entry that covers this area is the one-liner "Insights content redesign (not just chrome)" (`roadmap.md:58`). Treating the note-marker idea as an input to the design session rather than as a recorded decision.

### Other things that already work and should not be re-derived

| Thing | Where |
|-------|-------|
| Unit-correct plot conversion (seconds→min, bool→1/0) | `chartPlotValue`, `semantics.ts:61` |
| Unit label for an axis | `chartUnitLabel`, `semantics.ts:52` |
| Day completion incl. targets | `isElementDayComplete`, `semantics.ts:38` |
| Formatted day value for display | `formatTrackerHistoryDayValue`, `src/utils/trackerHistoryFormat.ts` |
| Note preview truncation | `truncateNotePreview`, same file |
| Trailing moving average | `movingAverage`, `chartStats.ts:6` |
| Best day / average-on-active-days | `computeActivityStats`, `chartStats.ts:40` |
| Schedule-aware personal best | `computePersonalBestStreak`, `chartStats.ts:73` |
| Locale-aware chart labels and full dates | `formatChartLabel`, `formatFullDate`, `src/utils/dates.ts:28` |
| Selection haptic | `playChartSelectHaptic`, `src/utils/habitHaptics.ts` |
| Stale-load guarding via generation counter | `InsightsScreen.tsx:102, 108, 122, 142, 149, 152` |
| Weather backfill, soft-failing offline | `ensureWeatherDailyRange.ts:23` |
| Weekly plant diversity | `weekDiversity.ts:32` |

### Things worth deleting rather than carrying forward

- `normalizeSeriesToUnit` (`chartStats.ts:22`) — its only caller is `InsightsScreen.tsx:228`. If cross-tracker comparison is dropped or re-based on targets, this function goes with it.
- `src/utils/insightsColors.ts` — five hardcoded hex values (`:2-8`), commented *"readable on light"*. They are not theme tokens, they are not in the `themeContrast` table, and nothing in `__tests__/` references them (verified by grep). Any redesign that keeps multi-series has to answer for these in dark and cartoon.

---

## 4. Constraints a redesign must respect

### Data and architecture

| Rule | Source |
|------|--------|
| Events are append-only day facts; never rewrite cross-day history | `.claude/rules.md`; `project-architecture.mdc` Data rules |
| Derived scores / points stay **computed**, never stored — no gamification tables | `project-architecture.mdc`, final line |
| Screens and stores never call `db.runAsync`; all SQL lives in `db/repositories/` | `.claude/rules.md`; `project-architecture.mdc` layers |
| Layer order: `protocol/` → repositories → kinds → stores → screens | same |
| A new table means one entry in `PERSISTED_CONCEPTS` — DDL, repair, clear stance, bundle key | `src/db/persistedConcepts.ts:24-41` |
| Do not scaffold protocol/DB features early | `.claude/rules.md` |
| Trackers vs catalogs vs ambient must not be collapsed | `protocol-plan.md`, three-classes table |

A redesign that only reads and aggregates needs **no** schema change. If it wants a new derived number to feel fast, the answer is a repository query or a pure helper, not a cache table.

### Appearance — each rule has a test that fails when broken

| Rule | Test |
|------|------|
| Colour from theme tokens; **never** dim text with `opacity` — secondary text is `QuietText` | `themeContrast.test.ts`, `noTextOpacity.test.ts` |
| Every theme pair clears 4.5:1, accent included | `themeContrast.test.ts` |
| `ThemeMode` (stored, includes `system`) vs `ResolvedTheme` (painted); anything keyed by theme takes the resolved one | `themeResolution.test.ts` |
| Anything animated consults `useReduceMotion`; meaningful motion keeps its end state via `springOrSnap` / `timingOrSnap`. Exemptions go in the test's `EXEMPT` map with a reason (`reduceMotionCoverage.test.ts:34`) | `reduceMotionCoverage.test.ts` |
| Text boxes use `minHeight`, never `height` | `fontScaling.test.ts` |
| Spacing from `space`, corners from `deco.radius`; a literal radius only where the value is half the height | `src/theme/spacing.ts`, `src/theme/decorations.ts` |
| Display face for what a screen is about, mono for quantities; body stays on the system font | `src/theme/typography.ts` |

**On the font-scale cap.** `CHART_LABEL_MAX_SCALE = 1.2` (`InteractiveDailyChart.tsx:12`) is applied to the per-bar value labels (`:263`) and the day-axis labels (`:298`). Its own comment is the justification:

```
/**
 * The axis packs one label per day at 9pt. It cannot reflow or wrap without the
 * columns colliding, so scaling is capped here rather than allowed to overrun.
 */
```

`__tests__/fontScaling.test.ts:10-12` records the same reasoning as the general rule — a pinned badge or a dense axis may cap its own multiplier, and *"capping costs legibility, so it is spent"* sparingly. **A chart axis is a legitimate place to cap** because up to 90 labels share one screen width, they are positioned by column index rather than laid out by flexbox, and there is nowhere for an overflowing label to go. That is the narrow exception — it does not license capping anywhere else in a redesign.

Note also that the chart hardcodes `CHART_HEIGHT = 168` (`:48`) and `styles.chartBlock` uses `height` (`:326-329`). That is geometry for an SVG canvas, not a text box, so it does not violate the `minHeight` rule — but any label row added around it does have to.

### i18n

EN and FR ship together in the same change (`ui-i18n.mdc`). Insights strings live in the **`insights`** namespace — `src/i18n/locales/en/insights.json` and `.../fr/insights.json`, both present. The namespace is shared: `screen.*` for Insights, `history.*` for Tracker History, and `TrackerHistoryScreen` loads `['insights', 'common']` (`TrackerHistoryScreen.tsx:55`). Dates and numbers go through `getDateLocale()`, never the device default alone.

Existing keys are listed in `en/insights.json`. Copy that describes the current control model — `capHint`, `tickToPlot`, `tickToCompare`, `weatherLabel` — becomes dead if the controls change, and must be removed from both locales in the same change.

### Platform and dependencies

- **Phone-first Android.** Web is secondary. Home pages all mount at once, so cold-start cost matters — but Insights is a stack screen reached from More, so it is not on that path.
- **No chart library is installed.** Adding one (`victory-native`, `react-native-gifted-charts`, `wagmi-charts`, …) is a real decision with size, Skia/Reanimated, and theming consequences. It needs to be decided explicitly, not slipped in.
- **`react-native-svg` 15.12.1 is already there** — everything the current chart does, plus axes, gridlines, per-point markers and dual scales, is achievable with it.

---

## 5. Open questions for the design session

Genuine forks — not answered here.

1. **What is Insights *for*?** A periodic "how am I doing" review, or a "what changed / why did that week go badly" diagnostic? These want different defaults, different ranges, and arguably different screens.

2. **One screen or several?** Today Insights is one scroll with three control clusters. Would separate destinations (a review, a single-tracker deep-dive, a day view) serve better than one screen that toggles between all of them?

3. **Is cross-tracker comparison worth keeping at all?** Given §1 — different units, no shared axis — is comparing trackers on one chart a real need, or an idea that survived because the toggles made it look possible? If it is real, what makes them comparable: percent-of-target (only works where targets exist), z-score, or an explicit dual axis capped at two series?

4. **If comparison stays, what is the y-axis?** Every option costs something. Percent-of-target excludes untargeted trackers. Raw dual-axis caps at two series and still invites false correlation. Small multiples abandon the shared axis entirely.

5. **Is weather a correlate or is it noise?** It is one location, one number per day, invisibly gappy, not backed up, and n ≤ 90. Does it stay as a first-class control, drop to day-panel context only, or go?

6. **What about archived trackers?** Insights hides them (`InsightsScreen.tsx:109`) while their events remain. Is "last 90 days" allowed to exclude a tracker archived last week?

7. **Does the timer session meta get used?** Start/end times, session counts and session lengths are on disk and untouched. Is "when and how long" part of the story, or is the daily total enough?

8. **Where do the non-tracker sources sit?** Todos completions, the weekly plant count and calendar occurrences are all real data in different protocol classes. Do they belong on Insights at all, or does Insights stay strictly about trackers?

9. **Is the tracker-picker model right?** Chips capped at 5 make the user configure the screen before it says anything. Should Insights choose what to show — most-active, at-risk, on-a-streak — and let the user drill in from there?

10. **What happens to Tracker History?** The two screens share one chart component. Does Tracker History become the single-tracker deep-dive that Insights links into, does it stay independent, or does one absorb the other?

11. **What is the default range, and is a fixed 7/30/90 the right axis at all?** Weekly buckets, calendar months, or "since this tracker started" (`created_at` is available) each tell a different story than a rolling window.

12. **Is a chart library on the table?** If the answer is yes, decide it before the layout work; if no, say so, because it bounds what the design can ask for.
