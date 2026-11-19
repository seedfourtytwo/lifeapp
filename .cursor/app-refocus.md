# App refocus — design brief (18 Nov 2026)

Step 6 of the handover (`.cursor/handover.md`), widened to quality, interaction and
simplification. Food/nutrition content is out of scope; only its *place* moves.

## Why

The Today widget is now the daily driver: one list, ticked without opening the app.
The app still has the prototype's shape — five swipe pages that split one day into
Habits / Counters / Nutrition / Todos, a More drawer of six unrelated rows, and a
statistics screen with no summary figure on it. The app's job is now: **mirror the
widget's day, then review, write, plan and manage.**

## Decisions

### 1. The pager: Today · Journal · Calendar · Review · More

- `HOME_TAB_ORDER = ['today', 'journal', 'calendar', 'review', 'more']`.
- The dock shows an icon **and a word** under it (caption size). Five unlabelled
  glyphs were not evident.
- Pages mount lazily: Today at start; another page the first time it is visited
  (dock tap) or when a drag towards it begins (both neighbours of the current page).
  A mounted page stays mounted. An unmounted page is an empty ground-coloured view.
- Stored last tab: `habits | counters | todos | nutrition` → `today`. `more` is
  still never restored. Unknown → `today`.
- Android back: any page → Today; Today exits. More returns to where it was opened
  from (unchanged rule).
- A `HomePagerContext` exposes `goToTab(tab)` so a sheet or row can send the user
  to a page (the calendar peek's "Open calendar", empty states).
- Pages that are not a day carry `PageHeader` (`src/screens/shared/PageHeader.tsx`):
  the title in `typeScale.screenTitle`, optional actions on the right, same height
  and position as the day header's title row.

### 2. Today — one list, same order as the widget

Order (it mirrors `TodayRules.kt`; keep them in step):

1. **Now** — habits whose timer is running. Label "Now". Only when there is one.
2. Open habits due today, in the user's order (no label).
3. Counters, in the user's order (no label). A counter that hit its target stays put.
4. **Todos** — label, the quick-add field, then open todos: overdue, today, later,
   undated. No sub-headings; each row says when it is due. Drag reorders within a
   due-group only, as today.
5. **Done** — label, then done/skipped habits, then todos finished today (tap the
   box to reopen).

Labels appear only when more than one section has rows — the widget's rule.

Header: the date, `x of y done` counted the widget's way (due habits + counters that
have a target and are not skipped + open todos + todos done today), the best running
streak, the 14-day strip over habits and counters together, weather chip, calendar
peek, notebook buttons, `+`.

One undo bar for the page. One clock. One set of peek sheets.

The Habits, Counters and Todos page shells go; their cards (`HabitCard`,
`CounterCard`, `TodoRow`) stay.

### 3. Review replaces Insights

Answers "how am I doing, and what needs attention". Montara's energy pages are the
model for the craft: **every figure comes with a plain sentence saying what it
means, and the card ends with one sentence saying what happened.** (Life's own
type rules still hold: no caps, no letter-spacing.)

- Range: Week (7 days) · Month (30) · Year (365), rolling, ending today.
- Headline tile: completion rate as a big figure, a caption saying what it counts,
  one comparison sentence against the window before, and a closing line that is
  either the tracker that slipped most or — when nothing did — that nothing did.
- One tile per tracker in the user's order: icon, name, strength score, and a strip
  for the range. Week and Month draw one cell per day; Year draws one thin bar per
  week. Tap → tracker history.
- Cell states are never told apart by colour alone: done = filled, missed = empty
  ring, skipped = centred dot, not scheduled / before it existed = nothing,
  today-still-open = ring in the accent.
- Tracker history gains: a year heatmap (53 × 7), a 90-day strength line, and the
  counter target-hit streak it used to zero out.
- Not built: best time of day, correlations, the weather overlay. The multi-series
  compare chart goes with Insights.

Maths lives in `src/review/` as pure functions with tests; completion, skip and
"scheduled" come from `src/protocol/dayRules.ts` — never re-derived — so the app,
the widget and Review cannot disagree.

### 4. More — manage and settings on one page

More stops being a menu that leads to a settings screen. It **is** the settings
page, with a Manage group on top:

- Manage: Trackers · Finished todos · Food · Ingredients
- Look: theme
- General: language, weather on Today, location
- Reminders: evening check-in (switch + time) — the preference existed with no UI
- Your data: back up, restore, clear data, clear a notebook
- Footer: icon and version

`WeatherLocation` becomes a root-stack screen; `SettingsNavigator`, the `AppSettings`
route and the `Insights`, `Journal`, `Calendar` routes go. `Nutrition` becomes a
pushed screen (a wrapper supplies the notebooks and note editor it used to get from
Home).

### 5. Craft

- Visual language stays moss / stone / ink, Newsreader + Plex Mono. Montara lends
  structure and voice, not palette.
- Todos use the tracker tile and tick: same height, same done-fill, same haptic.
- Anything that appears, disappears or moves does so with a transition, through
  `springOrSnap` / `timingOrSnap` (reduce-motion safe). No `LayoutAnimation`.
- Every sheet is the shared `EditorSheet` family, or looks and moves like it.
- All appearance rules in `.claude/rules.md` hold; their tests must stay green.

## Working rules for everyone on this

- TDD for logic: failing test first.
- EN + FR strings together. Delete strings you orphan.
- No new dependencies. No scaffolding for later.
- Checks: `npx jest <your tests>`, `npx tsc --noEmit`, `npm run lint`.
