# Life — app redesign plan (draft 1, 2026-11-11)

Status: DRAFT for Chris. Nothing here is built. Runs after the widget (stage 6), replaces the "reskin" part of stage 7.
Facts come from a full inventory of the current app (16 screens, 12 sheets, 72 system pop-ups, 872 strings).

## The one test

How many taps, and how much reading, between Chris and "logged". Every screen, option and line of code is judged by it. Pretty but slower loses.

Targets:

| | Today | After |
|---|---|---|
| Places in the dock | 5 | 3 |
| Taps to edit a tracker | 3 | 2 |
| Taps to add a counter | 3 | 2 |
| Habit editor fields | 19 | 8 |
| Explanation texts in the tracker editor | 15 | 2 |
| Long explanation strings (80+ characters) | 20 | 0 |
| System pop-ups (`Alert`) | 72 call sites | 0 (one own confirm sheet + undo) |
| Things only reachable by long-press | 6 | 0 (long-press stays as a shortcut only) |
| Raw typed dates and times (YYYY-MM-DD, HH:mm) | everywhere | none, real pickers |

## 1. Shape of the app

Today the app is sorted by *type of data* (Habits, Counters, Nutrition, Todos, More). Chris doesn't think "I will now do a counter". He thinks "what's next".

**Three places:**

1. **Today** — everything due today in one list: habits, counters, todos due. Next thing first, done things sink. The plants count is one tile here. One "+" adds anything. This is the approved Today mockup.
2. **Road** — how it's going: each tracker's road (streak, history), compare view, journal days. Merges today's History, Insights and the Journal's day list. This is the approved Road mockup.
3. **Journal** — notebooks and writing.

Everything else hangs off those: calendar and weather from the date header (as now), Settings from a gear on Today, Plants from its tile.

Gone as separate screens: Counters page, Todos page, More menu, Trackers library, Insights, Tracker history, Todo history (becomes a filter on Road).

## 2. One page per tracker

Tap a tracker's name → its page:

- top: what it is, today's state, the main action (tick / play / +N)
- its road: streak, last weeks, tap a day for its note
- **Edit** button, and Archive / Delete in a menu

So editing is 2 taps from Today, and nothing about a tracker lives anywhere else. Archived trackers: a single list in Settings.

## 3. Adding

One "+" on Today → four big choices: **Check-off · Timer · Counter · Todo** (Commitment joins in stage 6). The editor opens directly as a sheet; no detour through a library screen.

## 4. The tracker editor, cut down

Habit, from 19 fields to 8:

| Keep | Notes |
|---|---|
| Name + icon | icon is a tile next to the name, not a section |
| Type | Check-off / Timer |
| Goal (minutes) | timer only |
| Sound | timer only; pick a track or none |
| Days | every day / chosen days / every N days |
| Reminders | list of times, real time picker |
| Name on lock screen | from stage 3 |

| Cut | Why | What happens to existing data |
|---|---|---|
| Playback mode (track length / loop) | The app can work it out: a goal in minutes → loop until the goal; no goal → the track's length is the goal. The current hint is wrong anyway. | derived, no loss |
| Time window + "only show during window" | Third way of saying "when". Causes a save error with no visible fix, and a hidden habit still gets reminders. | dropped (Chris agreed 2026-11-11) |
| Reminder before start | Second reminder system. | converted once to a normal reminder time (window start minus N minutes) |
| Streak on/off | A whole section for one switch. Streak shows on the tracker page always; the card follows the design, not a setting. | dropped |
| "Note (optional)" (`targetLabel`) | Shown nowhere except the old library row. | dropped |
| `timeSlot` | Dead: always "anytime", nothing reads it. | dropped from schema |

Counter, 5 fields, fixed rather than cut:

- **Unit** becomes editable (today every counter says "reps", even water).
- **Buttons**: up to three, all visible on the card, first one is the big one. No long-press tray.
- Goal per day (optional). Word is "goal" everywhere, never "target".
- `allowNegative` deleted (dead).

Each removed field is removed in the schema, the editor, the save code and the tests, with a migration and a backup-import path for old files.

## 5. Settings, rebuilt

| Group | Contents |
|---|---|
| Look | Theme (default becomes System), Language |
| Notifications | Evening check-in + time; Reminders on/off; one line linking to Android's own notification settings for the rest (calendar, timer) instead of more switches |
| Backup | Last backup time, Back up now, Restore (stage 4 makes backup automatic, so this is mostly a status line) |
| Weather | On/off and place on one row; no sub-screen unless searching a city |
| Archived | Restore or delete old trackers |
| Data | "Delete history older than…" and "Erase everything", each one confirm. Clearing one notebook moves to that notebook's own menu. |
| About | Version |

Removed: the five-checkbox clear-data sheet with periods, all developer text ("needs a fresh app build", "reinstall the dev APK", "French model later"), "Proton Drive", "bubble position".

## 6. Words

- One name per thing: **goal**, **streak**, **reminder**, **note** (a line on a day), **journal** (notebooks), **food**, **archive**.
- One verb per action: **Add, Save, Delete, Archive, Restore, Back up**. (Today: Delete / Remove / Clear / Hide; Back up / Export / Import / Restore.)
- No helper text unless the action can't be undone. If a control needs a paragraph, the control is wrong.
- The ~45 unused strings and 7 duplicate "Save" keys are deleted.

## 7. One kit, Night road

The app currently mixes Material (React Native Paper) parts with hand-made ones: 5 kinds of chip, 4 kinds of pop-up, 3 section-heading styles, 78 hand-typed spacings, 49 type styles that skip the tokens.

One small kit, used everywhere, drawn in the Night road language of the widget and phone:

- Surface (glass tile), Row, Section
- Button: primary pill, quiet, icon — nothing else
- Field, Time picker, Date picker
- Chip, Segmented
- Sheet (bottom), Confirm (bottom, for the few irreversible things), Undo bar (for everything reversible)
- Road (the progress drawing), Lamp, Tail light

**Recommendation: retire React Native Paper**, screen by screen as each is rebuilt. Its Material look fights Night road, and it is the reason for most of the style mixing. Cost: we own menus, the snackbar and text fields ourselves (small). Risk: accessibility regressions — covered by keeping the existing contrast, font-scaling and reduce-motion tests, plus a new test that fails on any literal spacing, font size or Paper import in rebuilt screens.

Date and time pickers: Android's own, through the standard Expo-supported picker library (to verify against SDK 54 before use).

## 8. The less-used corners

- **Plants**: stays, off the dock. One food editor instead of two; nutrients, portions and matching fold under "More details" (they feed nothing yet).
- **Calendar**: one way to add an event (today four). Pickers. Same Sheet/Confirm.
- **Todos**: live in Today; quick-add stays; done ones are a filter on Road.
- **Notes editor**: same kit; drop the developer line about French dictation.

## 9. Build order (Opus, one branch per step, reviewed and phone-tested each)

1. Kit + Night road theme + the token test. No screen changes yet.
2. Today + the "+" flow + tracker page.
3. Editor cuts, schema clean-up, migrations.
4. Settings.
5. Road (history, compare, journal days).
6. Journal, notes, calendar, plants on the kit.
7. Remove Paper, sweep strings (en + fr), final accessibility pass.

Mockups for approval before step 1: tracker page, editor (habit + counter), the "+" sheet, Settings, Journal. (Today and Road are already approved.)

## Decided by Chris, 2026-11-11

1. Time window and "only show during this window" are cut. Reminder-before-start converts to a normal reminder time.
2. One Today list replaces the Habits, Counters and Todos pages.
3. Plants leaves the dock and becomes a tile on Today.
4. Mockups in `night-road-app.html` approved as the direction ("Yes, this direction"): dock is Today, Road, Journal and "+"; gear on Today; counters show up to three buttons.

5. **Sound on habits is a hard requirement** (Chris, 2026-11-11): press play, the breathing guide or meditation music starts. It must stay one tap, work from the lock-screen widget, and survive every rebuild step. Only the "track length / loop" question is removed from the editor.

7. **No glow** (Chris, 2026-11-11: "simple and sharp and pleasant and clean, not kitsch AI"). Colour appears only as a thin line: a 1.5 px ring, a progress line, a small dot. No blurred halos, no coloured light bleeding into tiles, no drop glows. Applies to widget and app. If a screen needs an effect to look finished, the layout is wrong.
6. No light theme (Chris, 2026-11-11). Night road is the only look: the Theme row leaves Settings, and the theme-mode setting, system/light/dark resolution and their tests are removed in the rebuild.
