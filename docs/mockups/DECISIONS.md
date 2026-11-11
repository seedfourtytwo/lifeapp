# Widget and UI decisions (Chris, 2026-11-11) — to fold into the clean-slate spec

- Layout: a widget that changes with the moment (morning routine / evening scoreboard / after an urge tap), built from small pieces.
- The widget must control timers without unlocking: start, pause, resume, stop/done. Consequence: timers (state, ticking, sound) must be owned by native Android code (foreground service + media playback) so they work with the JS app dead; React Native becomes a client of that timer. This moves the "native core" from optional to required and ahead of the widget.
- No Donna anywhere in the app or widget: drop the weekly scoreboard share and any "D sees this" line.
- Content at a weak moment: hard numbers (today, time clear, urges ridden out), one line written by sober Chris (changes on milestones), one button that starts a ten-minute alternative, an Urge button, next milestone closing in. No arguments, no quote feed.
- Lock-screen privacy: neutral labels only.
- Looks matter: Chris wants it visually appealing and "cool", and the whole app UI reviewed. Visual direction to be chosen from mockups in this folder; implementation of the new look happens with the Today-first layout, after the function stages.

## Visual direction: "Night road" (approved by Chris 2026-11-11)

Mockup: `night-road.html` / `night-road.png` in this folder. Source of the language: `~/Dev/workspace/lawnchair-icons` (`glass.mjs`, `wallpaper.mjs`). Long-term goal: one coherent UI across Chris's projects (Life, Montara, Photos).

- Night background `#0A0A22 → #15153C → #26245E → #3E3280` (horizon) over ground `#0B0A1E`.
- Glass surfaces `#1A2030 → #0E131D → #070A10` at ~0.9 alpha, top edge highlight, bottom radial tint in the tile's light colour.
- Cream `#EFE9DC` for text and marks; ink `#0A0D14` for cut-outs.
- Three lights, each meaning a kind of thing: violet `#8B7CFF` (tint `#3A3484`) commitments; teal `#4FD6C6` (tint `#1C5A58`) practice; amber `#F2B35B` (tint `#5A4320`) upkeep and urges. Lamp `#FFE7B3`, tail light `#FF4A3D`.
- One lit feature per tile. Round glass for tools/controls, squircle glass for things.
- Type: Inter only. ExtraLight for numbers (echoes the lock-screen clock), Medium for names, Light a size up for Chris's own words. Tabular numerals.
- The road is the progress picture: centre dashes are days (bright done, dim missed), lamps are milestones, tail lights are "you"; a missed day dims one dash and never clears the road. An urge is a ten-minute drive to the next lamp.
- Widget moments: morning (next routine item: Start / Later / Skip), timer running (stop, pause, done), evening (clear time, today count, ridden out, strength, own line, "10 min yoga", "Urge"), after an urge tap (countdown to the lamp, "Play my note").
- App: one Today screen (commitment pinned, large next-up tile, done items folded into one line, Morning/Day/Evening groups, seven-day dashes per row), a Road screen replacing Insights, round glass dock.
- Replaces the current stone/ink/moss theme and the Newsreader + IBM Plex Mono pairing. Existing appearance tests (contrast ≥ 4.5:1, no text opacity, reduce motion, font scaling) still apply and must pass with the new tokens.
- Built together with the Today-first layout, after the function stages.

## Lock-screen widget spike: results (Pixel 9, GrapheneOS, Android 17, 2026-11-11)

Spike code: branch `spike/lock-widget` (commit 712e063), module `modules/life-widget-spike`. Throwaway.

- The widget is offered on the lock-screen page and reports `OPTION_APPWIDGET_HOST_CATEGORY = keyguard(2)`, so it can switch to neutral labels there.
- Size given on that page: 447 x 298 dp (min = max, i.e. one fixed size, nearly full width). Design for that box; taller content does not fit one widget.
- Broadcast buttons fire while locked (`locked=true`): Count, Start, Pause all worked from real taps.
- A `Chronometer` in RemoteViews counts on screen by itself and stops on pause (Chris saw it). A running timer needs no per-second updates from us.
- An activity button asks for unlock first, then opens (the activity's `onCreate` ran).
- A foreground service started from the widget's broadcast receiver on a locked phone is ALLOWED when the tap comes from the user: `startForegroundService returned OK`, `startForeground OK`, ran its 60 s. (The same call from an adb broadcast throws `ForegroundServiceStartNotAllowedException`, as expected.) Chris saw no notification for it; channel importance / lock-screen visibility to be set properly in the real build.
- With the screen off and no wake lock, 5 s ticks stretch to 7–14 s. Timers must compute from a stored start time and never count ticks; a real timer service plays audio (media playback keeps it awake) or schedules an exact alarm for the target.
- Not tested: a tap arriving when the app process is dead (the process stayed alive for 6 h; force-stop was off-limits). To check in the real build.

Design consequences: lock-screen control of timers is feasible with native code only (receiver → foreground service, Chronometer for display, exact alarm at target). Logging (urge, check-off) is a plain broadcast. Anything that needs a screen (voice note recording, editing) needs unlock. One 447 x 298 dp box per widget means the "changes with the moment" design must fit that box, or use two stacked widgets.

## Reminder on the lock screen (Chris, 2026-11-11)

The 18:34 test reminder arrived on the lock screen, but Chris's phone hides notification details while locked, so it showed no habit name. Follow-up for the reminders work: let a reminder show its text on the lock screen when the habit is marked safe to show. Use the habit's optional "lock-screen name" (already planned for the widget) as the public text; habits without one stay hidden. To verify before building: how expo-notifications 0.32 exposes Android notification visibility (channel `lockscreenVisibility` and/or a per-notification public version), and that GrapheneOS honours it with "hide sensitive content" on.
