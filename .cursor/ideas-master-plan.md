# Ideas master plan — review draft

**Status:** Track 1 easy wins **complete** on branch `fix/easy-wins-w1-w8` (W1–W6; W4 cancelled, W5→T2). Next up is **Track 2** UI rework or a dedicated future session below.  
**Native builds:** **local Android SDK** (default). Debug app = package `…dashboard.dev`, launcher **dev**. EAS optional backup.  
**Sources (2026-07-22 export):** journal (hit 4k) + Study habit note + Workout habit note + `.cursor/product-ideas.md` + competitor scout.

**Product north star:** phone-first Android, local SQLite, Habits + Counters as equals, Life Protocol kinds only when UX diverges, ambient outside protocol, EN+FR together, ship small chunks.

---

# Work order (start here)

**Track 1** (easy wins) is done. Then **Track 2** (UI/graphics). **Export/import** and **lock screen** are **not** small Track 1 leftovers — each is its own full session later.

## Native rebuild backlog

When a change needs a new APK, list it here so nothing is missed before/after install.

| Dep / reason | Why | Track item | Status |
|--------------|-----|------------|--------|
| `expo-clipboard` | True copy-paste for notes/journals | **W2** | Done — in local **dev** APK |

Rebuild command:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2
adb install -r app/build/outputs/apk/debug/app-debug.apk
# Launcher: "dev" · package com.lifeapp.dashboard.dev
```

## Track 1 — Easy fixes / wins (coding order)

Small, high leverage, mostly isolated. **Finished** before the big visual rework.

| # | ID | Item | Status | Needs native rebuild? | Est. |
|---|-----|------|--------|----------------------|------|
| 1 | **W1** | Dictation **Done** i18n (A2) | Done | No (Metro) | S |
| 2 | **W2** | **Copy** journal / note body (B3) | Done | Yes (`expo-clipboard`) — shipped | S |
| 3 | **W3** | Char-limit warning (A1); hard max 128k; warn only when near | Done | No (Metro) | S–M |
| 4 | **W4** | Mic listening affordance in text mode (A3) | **Cancelled** — keep dictation live in text mode; header Done/mic is enough | — | — |
| 5 | **W5** | Drop clutter copy e.g. **“reps”** on counters | **Moved → Track 2** (Home cards / T2b) | — | — |
| 6 | **W6** | Counter **target-hit streak** on card (opt-in with daily target); habit streaks already shipped | Done (Metro) | No | S–M |
| — | ~~W7~~ | Journal plain export/share | **Moved → Session Export** (not a thin slice) | — | — |
| — | ~~W8~~ | Lock-screen single session | **Moved → Session Lock** (full rework) | — | — |

**Explicitly not in Track 1:** voice “Done done” commands, undo/redo stacks, Proton Drive, drag-reorder, hold-+5/+10, Insights rewrite, new kinds (todos/food/idea inbox), **W5** copy clutter (Track 2), **export/import** (Session Export), **lock screen** (Session Lock).

**Next action:** **Track 2** (start with T2a design brief) — or jump to Session Export / Session Lock when prioritizing those.

---

## Track 2 — UI / graphics rework (separate mega-chunk)

One coordinated visual language pass — **not** mixed into Track 1. Own series of sessions after Track 1 (or before Session Export/Lock if visuals matter more).

### Scope (in)

| Area | From inventory | Notes |
|------|----------------|-------|
| **Home cards** | C1, C2, C4 layout · **W5** | One-line habits; progress as border/background; counter +1 primary look; drop “reps” / clutter units; sticky-note+mic icon; larger sharper icons |
| **Tracker editor / menus** | C6 | Habit & counter edit panels — less ugly, clearer sections |
| **Ambient bubble** | D1, D2, D3 | Shape ↔ weather morph; richer date/temp/rain; drag physics; long-press → next-day chips |
| **Sheets & transitions** | F1, B1 expand | Smooth open (no flicker); journal preview → expand-down |
| **Settings / Insights chrome** | I1 (visual shell first) | “Menu redesign” — structure & look; Insights **content** model can stay Later |
| **Haptics / chime taste** | F2 | Only **after** layouts settle — consistency pass |

### Scope (out of Track 2 — keep separate)

- **Session Lock** / lock-screen dictation (H1)
- **Session Export** / Proton backup (G3) / event-type product work (E1) beyond visual chips
- New surfaces: idea inbox, todos, food, quotes (J*, B7, D5)
- Competitor protocol features (skip day, heatmap, EMA) — Session K

### Suggested Track 2 session split (when we get there)

1. **T2a** — Design brief: typography, spacing, card anatomy, bubble rules (no code or minimal spike)
2. **T2b** — Habit + counter Home cards
3. **T2c** — Tracker editor / settings menus
4. **T2d** — Weather/calendar bubble (content + motion)
5. **T2e** — Sheet transitions + journal expand
6. **T2f** — Haptics/sound taste pass

---

## Future dedicated sessions (not Track 1 leftovers)

Former **W7** / **W8** were too small as “easy wins” — each belongs to a full revamp. Schedule when ready; order vs Track 2 is a product choice.

### Session Export — Granular export / import revamp

**Absorbs:** former **W7** / B4 (plain journal/notes share), **G1** (by type), **G2** (date/type filters), related E1 type-filtered export. **Not** Proton/cloud (G3 stays Later).

**Goal:** One coherent Settings flow for export + import — pick data types (like Clear data…), optional date range, plain text / markdown / JSON as needed for AI recaps and backups, merge vs replace on import.

**Suggested chunks (when the session starts):**
1. Product brief: categories, formats, merge/replace rules, EN+FR copy.
2. Export pipeline + UI picker (types + range).
3. Import pipeline (validate, merge/replace, versioning).
4. Journal/notes plain share as one export preset (old W7), not a one-off.

**Size:** L · **Layer:** DB + settings UI

---

### Session Lock — Lock-screen / media-session rework

**Absorbs:** former **W8** / A4 (single timer session, no duplicate controls). **Then** H1 (dictation / Done / richer actions) only after the session model is clean.

**Goal:** One owned lock-screen / media session for habit timers; unlock syncs into the in-app session; no duplicate slides. After that is solid, decide which extra actions belong on the lock screen.

**Suggested chunks:**
1. Reproduce & diagnose current media-session / lock-screen queue.
2. Single-session ownership (start/pause/done) + unlock merge.
3. **Later in same or follow-up session:** H1 lock-screen dictation / habit Done / quick capture (Android constraints).

**Size:** L · **Layer:** native / audio

---

## Later / parking lot (after Track 1–2 + dedicated sessions)

| Bucket | Items |
|--------|-------|
| Interaction upgrades | C5 drag-reorder · C4 hold-+N (if not in T2b) · D4 shake refresh |
| Notes power | B2 undo/redo · B5 voice commands + last-sentence confirm · B6 FR/EN dictation policy |
| Data | **Session Export** (G1/G2/B4) · G3 Proton/scheduled backup |
| Stats follow-ups | Counter **target-hit streak in History / Insights** (Home card cache is not stats — recompute or surface there when Insights content is planned) |
| Native | **Session Lock** (A4) · then H1 lock-screen dictation · home widgets (K/E) |
| Product TBD | B7 idea inbox · J1 todos · J2 food · D5 quotes · F3/F4 audio |
| Competitor K | Skip · heatmap · EMA · duplicate · CSV · day-starts-at · … |

---

## Legend (inventory sections below)

| Field | Meaning |
|-------|---------|
| **Verdict** | `Keep` · `Later` · `Drop` · `Needs design` · or Track ref (`W3`, `T2b`) |
| **Size** | S / M / L |
| **Layer** | UI · protocol · DB · native · ambient |

---

# A — Bugs & friction (fix / high leverage)

Things that already hurt daily use. Prefer these before big redesigns.

### A1 · Note / journal length warning (dictation)

**Idea:** Stronger warning when approaching the ~4 000-char limit — especially during **voice** capture. A whole chunk was lost at the cap and forgotten.

**Chunks:**
1. Visible progress / threshold warning before max (e.g. 80%, 95%).
2. Soft-block or clear “cannot append more” while dictating (don’t silently drop).
3. Optional later: raise limit or auto-continue into a second day/overflow note.

**Verdict:** **W3** · **Size:** S–M · **Layer:** UI (+ maybe protocol max)

---

### A2 · Dictation “Done” i18n

**Idea:** Done button on note/journal dictation not translated to French.

**Chunks:**
1. Audit note editor / dictation chrome for hardcoded EN; add keys EN+FR.

**Verdict:** **W1** · **Size:** S · **Layer:** UI / i18n

---

### A3 · Mic state while editing text

**Idea:** When switching to text mode, make mic on/off state obvious (confusion during dictation testing — mic can still be live).

**Decision (2026-07-23):** **Cancelled as W4.** Keep dictation continuous while editing text (intentional). Header **Done** + filled mic is enough; no auto-pause and no extra affordance.

**Verdict:** **Cancelled** · was **W4**

---

### A4 · Lock-screen timer session duplication

**Idea:** Starting a habit timer seems to spawn another lock-screen / media-session control. Want **one** session control; on unlock, merge into in-app session cleanly.

**Chunks:**
1. Reproduce & diagnose current media-session / lock-screen queue.
2. Single-session ownership (start/pause/done).
3. Unlock → sync state with in-app timer (no duplicate slides).

**Verdict:** **Session Lock** (was W8) · **Size:** L · **Layer:** native / audio  
**Related:** `product-ideas.md` → Lock screen widget · then **H1**

---

# B — Notes & journal (capture & review)

### B1 · Journal vs tracker notes — clearer distinction

**Idea:** Rework journal so daily journal feels distinct from tracker day notes; easy expand to full text (slide-down, light animation).

**Chunks:**
1. Information architecture: Home entry points for Journal vs per-habit notes.
2. Expand-in-place / preview → full body (animated).
3. Review / history panel rethink (“note review panel”).

**Verdict:** **T2e** · **Size:** M · **Layer:** UI

---

### B2 · Undo / redo in note & journal editor

**Idea:** Slick undo/redo for phone journal entries and notes.

**Chunks:**
1. Text undo stack while editing (session-local).
2. Placement that doesn’t crowd dictation controls.

**Verdict:** **Later** · **Size:** M · **Layer:** UI

---

### B3 · Copy journal / note to clipboard

**Idea:** One-tap “copy whole text” so notes can be pasted into AI / elsewhere.

**Chunks:**
1. Copy action on journal + tracker note sheets.
2. Toast / a11y confirmation (i18n).

**Verdict:** **W2** · **Size:** S · **Layer:** UI

---

### B4 · Journal / notes export for AI recaps

**Idea:** Easy export of journal texts for AI action/recap — later maybe “straight up if you have internet.”

**Chunks:**
1. Export journals (and optionally day notes) as plain text / markdown / JSON slice.
2. Date-range filter (ties to export UX in §G).
3. **Later / needs design:** any online AI path (out of local-first default — careful).

**Verdict:** **Session Export** (was W7; fold into granular export) · online AI → **Later** · **Size:** part of L session · **Layer:** DB export · ambient

---

### B5 · Voice commands in dictation

**Idea:** Voice “Done” / “Done done” to finish capture; optional voice formatting (“next chapter” → section break / dashes). Visual confirmation of last captured sentence so nothing is truncated unnoticed.

**Chunks:**
1. Voice command: Done / stop (locale-aware).
2. Last-sentence / end-of-capture flicker confirmation.
3. Formatting keywords (“next chapter”, section rules) — polish after core reliability.
4. Discrete pause/stop that feels instant.

**Verdict:** **Later** · **Size:** M–L · **Layer:** UI / speech  
**Note:** Dictation language already follows app language — keep that.

---

### B6 · Mixed FR/EN dictation in one note

**Idea:** Mixing French and English in one note; question whether a language switch is needed or something smarter.

**Chunks:**
1. Document current behavior (app-locale speech).
2. Decide: stick with app language, manual toggle, or auto (hard).

**Verdict:** **Later** · **Size:** S (doc/toggle) / L (auto) · **Layer:** speech / settings

---

### B7 · Idea inbox (not day-bound)

**From:** `product-ideas.md`  
**Idea:** Capture brainstorms **not** tied to a calendar day (unlike journal / day notes).

**Chunks:**
1. Product design: screen vs section; archive/done; link to habits/todos later?
2. Only then: schema + UI (do not scaffold early).

**Verdict:** **Later** · **Size:** L · **Layer:** ambient or new surface  
**Caution:** Competitor doc marks “notes/tasks modules” as avoid-for-now — reconcile in review.

---

# C — Home · Habits & Counters cards

### C1 · Habit cards — compact one-line layout

**Idea:** Habits on one line: small Start → becomes Pause; Complete nearby when done; cohesive graphic line; less crowded; icons a bit larger / sharper.

**Chunks:**
1. Card layout redesign (boolean + timer variants).
2. Start/Pause/Complete affordances in one row.
3. Icon sizing / sticky-note+mic for note entry.

**Verdict:** **T2b** · **Size:** M · **Layer:** UI

---

### C2 · Habit progress presentation

**Idea:** Progress as background, border ring, or otherwise “slick” — not a heavy bar. Meta: “N remaining for today.”

**Chunks:**
1. Visual treatment for remaining / progress.
2. Remaining-count copy on Habits tab (i18n).

**Verdict:** **T2b** · **Size:** S–M · **Layer:** UI  
**Note:** Some remaining meta already exists — audit before redesign.

---

### C3 · Streaks on the line (habits + counters)

**Idea:** Surface streak number on habit/counter cards (“on that line”).

**Decision (2026-07-23):** Habit streaks already on cards. **W6** = counter **target-hit** streak (consecutive days `total ≥ dailyTarget`), opt-in toggle when a daily target is set (default on). No counter failure streak / schedule.

**Follow-up (Later):** Surface counter target-hit streaks in **History / Insights** — Home `counterStreaks` is only an in-memory card cache, not stats storage.

**Verdict:** **W6** Done · History/Insights streak → **Later** · **Size:** S–M · **Layer:** UI + store

---

### C4 · Counter cards — +1 primary, hold for +5/+10

**Idea:** Counters: mainly +1; short hold expands quick chips (+5, +10, …). Drop “reps” wording if clutter.

**Chunks:**
1. Primary +1; long-press / hold expand increments → **Later** (or T2b if natural).
2. Copy cleanup (reps / units) → **W5** (Track 2 / T2b — not Track 1).
3. Keep undo / set-total paths discoverable.

**Verdict:** layout + copy **T2b** (includes former **W5**) · hold-+N **Later** · **Size:** M · **Layer:** UI

---

### C5 · Drag-to-reorder cards

**Idea:** Long-press habit/counter cards to reorder instead of Sort mode click flow.

**Chunks:**
1. Drag-and-drop reorder on Home lists.
2. Keep or retire current Sort / ReorderControls.

**Verdict:** **Later** · **Size:** M · **Layer:** UI

---

### C6 · Tracker editor panels (Settings)

**Idea:** Habit/counter edit panels in settings feel ugly — rework per kind.

**Chunks:**
1. Visual/IA pass on `TrackerEditorDialog` + habit/counter fields.
2. Sound / schedule sections clarity (no new fields unless needed).

**Verdict:** **T2c** · **Size:** M · **Layer:** UI

---

# D — Ambient bubble · weather & calendar

### D1 · Weather bubble content & shape

**Idea:** Bubble shape hints sun/cloud/rain with sleek morph; inside: richer date (“20 July”), temp, min/max, rain %. Clever way to bring calendar alongside.

**Chunks:**
1. Richer content in bubble (date format, temp, precip).
2. Shape / weather-state animation (keep performance phone-friendly).
3. Calendar integration concept (without cluttering first glance).

**Verdict:** **T2d** · **Size:** M–L · **Layer:** ambient UI

---

### D2 · Bubble physics / feel

**Idea:** More bubbly transparency; lag/follow after drag; edge bounce; fast flick bounce vs slow gentle drag.

**Chunks:**
1. Motion polish on bubble drag (spring / decay).
2. Edge bounce; speed-dependent release.

**Verdict:** **T2d** · **Size:** M · **Layer:** UI motion

---

### D3 · Long-press → next-day weather chips

**Idea:** Hold weather bubble → expands sideways with similar bubbles for following days.

**Chunks:**
1. Long-press expand UI.
2. Wire to forecast cache for N days.

**Verdict:** **T2d** · **Size:** M · **Layer:** ambient UI

---

### D4 · Shake to refresh weather

**Idea:** Shake phone → refresh weather with visible refreshing state. Question: is it useful?

**Chunks:**
1. Decide usefulness vs button/pull refresh.
2. If keep: accelerometer + refresh UX.

**Verdict:** **Later** (usefulness TBD) · **Size:** S–M · **Layer:** native / ambient

---

### D5 · Daily quotes / motivators

**From:** `product-ideas.md`  
Ambient rotating quote near bubble or quiet Home accent.

**Verdict:** **Later** · **Size:** M · **Layer:** ambient

---

# E — Calendar

### E1 · Event types (birthday, etc.)

**Idea:** Support different event types (not only matching one kind); may not all show the same way in UI. Ability to export e.g. **all birthdays**.

**Chunks:**
1. Surface event-type picker (schema already has birthday/appointment — see calendar-plan “Later”).
2. Presentation rules per type.
3. Filtered export by type (ties §G).

**Verdict:** **Later** · **Size:** M · **Layer:** calendar ambient  
**Related:** `.cursor/calendar-plan.md` Later list

---

# F — Motion, haptics, sound polish

### F1 · Screen transitions

**Idea:** Smoother sheet/screen open transitions — less flicker, no added delay/jank.

**Chunks:**
1. Audit navigation / Modal / Paper transitions.
2. Fix flicker sources; keep snappy.

**Verdict:** **T2e** · **Size:** M · **Layer:** UI

---

### F2 · Haptics & chimes pass

**Idea:** After UI changes, rethink little shakes, chimes, audio — only where they help.

**Chunks:**
1. Inventory current haptics/sounds.
2. Consistency pass (complete, increment, errors).

**Verdict:** **T2f** · **Size:** S–M · **Layer:** UI / audio

---

### F3 · Habit timer ambient audio library

**Idea:** Optimize / loop ambient sounds (fireplace, rain, snowy night); small reasonable library; per-habit volume + theme picker from habit note/control area.

**Chunks:**
1. Measure APK/asset size budget.
2. Looping ambient assets + volume control.
3. Per-habit theme selection UI.

**Verdict:** **Later** · **Size:** L · **Layer:** audio / habit config

---

### F4 · Breathing sessions (variants + rounds)

**Idea:** For breathing habits: choose session style (relax / intensive) and number of rounds, constrained by what fits realistically (and any video assets).

**Chunks:**
1. Product: is this still a `habit` timer config or a specialized flow?
2. Config UI + playback structure.
3. Asset budget.

**Verdict:** **Later** · **Size:** L · **Layer:** habit / audio  
**Caution:** Don’t invent a new kind unless UX truly diverges.

---

# G — Backup, export, import

### G1 · Granular export / import by data type

**From notes + `product-ideas.md`**  
Split like **Clear data…** already does: history, calendar, notes/journals, prefs, definitions.

**Chunks:**
1. Export picker by category.
2. Import merge vs replace per type.
3. Versioning / missing sections.

**Verdict:** **Session Export** · **Size:** M (within L session) · **Layer:** DB

---

### G2 · Fine-grained date / type filters on export

**Idea:** Discreet timeframe control (month/year slider; hold to day granularity); frame adjusts to available data. Export birthdays-only, etc.

**Chunks:**
1. UX for range (months default; days on hold).
2. Apply to journals, calendar, history slices.
3. Combine with type filters (§G1, §E1).

**Verdict:** **Session Export** · **Size:** M (within L session) · **Layer:** UI + export

---

### G3 · Scheduled / remote backup (Proton Drive)

**Idea:** Regular backup while away; upload to Proton Drive when connection available; otherwise store locally — not other clouds.

**Chunks:**
1. Local scheduled backup file first (reminder or auto file).
2. Proton Drive integration research (API / WebDAV / share intent / manual folder).
3. Upload-on-connectivity policy.

**Verdict:** **Later** · **Size:** L · **Layer:** native / settings  
**Caution:** Local-first product — cloud optional, never required. Competitor doc: avoid cloud sync CTA for now; scheduled **local** backup is closer to Loop.

---

# H — Lock screen & quick capture (beyond bugfix)

### H1 · Lock-screen dictation / actions

**From:** `product-ideas.md` + Study note  
After **Session Lock** (A4) is solid: dictation or Done from lock screen / quick entry — not only Play/Pause/Done on timer.

**Chunks:**
1. What actions belong on lock screen (timer, habit Done, dictation → note/idea/todo).
2. Android constraints for lock-screen input.
3. Reuse in-app speech locale / continuous dictation.

**Verdict:** **Later** (after Session Lock) · **Size:** L · **Layer:** native

---

# I — Insights

### I1 · Insights pager redesign

**Idea:** Replan Insights UI dramatically — whole planning session of its own.

**Chunks:**
1. Dedicated planning session (goals of Insights vs Home history).
2. Then implement in slices.

**Verdict:** chrome → **T2** · content model → **Later** · **Size:** L · **Layer:** UI  
**Note:** Explicitly called out as its own planning session.

---

# J — New product surfaces (from existing inbox)

Review against “do not over-build early” and competitor non-goals.

### J1 · To-dos (one-off, usually undated)

**From:** `product-ideas.md`  
Distinct from habits, calendar, counters.

**Verdict:** **Later** · **Size:** L · **Layer:** TBD (likely ambient, not a new kind until forced)

---

### J2 · Food tracking

**From:** `product-ideas.md`  
Meals / intake — light log vs nutrition; kind vs ambient TBD.

**Verdict:** **Later** · **Size:** L · **Layer:** TBD  
**Caution:** New kind only if UX diverges for real.

---

# K — Competitor-inspired backlog (already prioritized)

Keep as a parallel track; don’t mix into “voice dump” until after review. Full detail in `.cursor/competitor-inspiration.md`.

| Session | Themes |
|---------|--------|
| A | Skip day · habit heatmap history · per-day note on completion |
| B | Habit strength (EMA) · urgency sort · hide completed |
| C | Duplicate tracker · personal best · CSV export |
| D | `times_in_y_days` schedule · day-starts-at setting |
| E | Android home widgets · Tasker/intents |

**Note:** Some overlap with this dump (streaks, export, notes). Deduplicate when assigning Keep.

---

# Capture meta (process)

- Dictation overflow into habit notes worked as a workaround — **W3** exists because the journal cap ate ideas.
- Work order: **Track 1 (done)** → **Track 2 (T2a→T2f)** and/or **Session Export** / **Session Lock** when those are the priority.
- Each item → short acceptance note if needed → one coding session → next.

---

## Raw source map (for traceability)

| Theme | Journal | Study note | Workout note | product-ideas |
|-------|---------|------------|--------------|---------------|
| Char limit warning | truncated | ✓ | | |
| Lock screen session | | ✓ | | ✓ |
| Voice Done + last sentence UI | | ✓ | | |
| Tracker editor ugly | | ✓ | | |
| Journal expand / distinct | | ✓ | | |
| Transitions / bounce | ✓ bubble | ✓ screens | slick UI ethos | |
| Undo/redo notes | | ✓ | | |
| Weather bubble rich + morph | | ✓ | | |
| Hold → next days | | ✓ | | |
| Drag reorder | | ✓ | | |
| Shake refresh weather | | ✓ | | |
| Habit one-line cards | ✓ | | | |
| Counter +1 / hold expand | ✓ | | | |
| Sticky-note mic icon | ✓ | | | |
| Copy / export journals | ✓ | | ✓ filters | ✓ granular |
| Streaks on cards | ✓ | | | |
| Ambient audio themes | ✓ | | | |
| Breathing variants | ✓ | | | |
| Event types + birthday export | | | ✓ | |
| Proton / scheduled backup | | | ✓ | |
| Insights redesign | | | ✓ | |
| Idea inbox / todos / food / quotes | | | | ✓ |
