# The Night road kit

`src/ui/`. Every rebuilt screen is composed from these parts and nothing else. All colours, gaps, corners, line widths, type, sizes, layers and timings come from `src/ui/tokens.ts` (spacing is the shared `space` scale, re-exported there). To see every part in every state, open Settings → Kit gallery in a development build.

## Parts, and when to use which

Surfaces
- `GlassSurface`: a glass tile. `size="tile"` in a list, `surface` standing alone. `light` gives it a lit edge, only when nothing inside it is lit. `onPress` makes the whole tile one button (a notebook, a "+" choice).
- `Section`: a quiet label over content. `grouped` puts the children in one glass with a `Divider` between each: a block of Settings rows.
- `Row`: label, optional value, then a trailing control (`Toggle`) or a chevron. `dot` for a status line, `danger` for the few rows that cannot be undone.
- `Divider`: the 1dp line between rows. Never a hairline.
- `Mark`: a thing's icon in a squircle. `Dot`: a small light beside a name.

Buttons, and nothing else
- `PillButton`: `primary` (lit ring, the one thing to press), `quiet`, `danger` (only inside a confirm). `compact` for "Edit" beside a title.
- `RoundButton`: a tool. One icon, or a few characters ("+1"). `sm` in a header, `md` on a tile and in the dock, `lg` for a tile's one main action. `light` lights it.
- `TextButton`: a quiet inline action (Undo on the bar).

Inputs
- `Field`: label inside on the left, value on the right. With `onPress` it opens what changes it (a picker, a list); with `onChangeText` it is typed into. Numbers are typed too: `numeric` and a `unit`, no stepper.
- `Toggle`: on/off. `Segmented`: one of two or three. `Chip`: a choice among a few, a time, a button value; `add` is the "+" at the end of a row of chips.
- `TimeField`, `DateField`: open the phone's own clock or calendar; never a typed `HH:mm` or `YYYY-MM-DD` on the phone. Times read on the 24-hour clock, dates in the app language. For a time shown as a chip, call `pickTime` / `pickDate` (`phonePicker.ts`) directly.

Overlays (held by `KitHost`, mounted once around the navigator)
- `Sheet`: everything that opens over a screen. Grabber, scrim, Android back and a pull down close it; it sits on the keyboard; `fill` for an editor.
- `useConfirm()`: `await confirm({ title, line, action })` is true only for the action. Only for what cannot be undone.
- `useUndoBar()`: `show({ message, onUndo })` after anything reversible; `show({ message })` for a plain notice such as a failed write. One at a time; a new one replaces the old.

Navigation and progress
- `Dock`: the three places, round glass, the current one lit, "+" as its action. `ScreenHeader`: back, title, a few actions; without back it is one of the three places and its title is larger.
- `ProgressLine`, `WeekDashes` (done, missed, not counted, today), `Road` (days behind the car, a lamp, the car). `DayMark` is the one vocabulary for both.
- `Icon`: the app's icon font, sized and toned by token.

## Rules

- One lit feature per tile: a lit button, a dot, a progress line or a lit edge, never two.
- Round glass for tools (buttons), squircle glass for things (marks).
- Colour means a kind of thing: violet commitments, teal practice, amber upkeep and urges. Lamp and tail light only on the road. Danger only for what cannot be undone. Never decoration, never glow.
- Text is dimmed by `creamDim`, never by opacity. Opacity is only whole-control state (pressed, disabled).
- No helper text unless the action cannot be undone. If a control needs a paragraph, the control is wrong.
- One verb per action: Add, Save, Delete, Archive, Restore, Back up. One name per thing: goal, streak, reminder, note, journal, food, archive.
- Act at once and offer Undo; confirm only the irreversible. No `Alert.alert` in a rebuilt screen.

Each rule a test can see is enforced: `kitTokensOnly.test.ts` (no literal colour or size, no Paper import, no `Alert.alert` in `src/ui/` and the rebuilt screens listed there; add a screen to that list when it is rebuilt), `themeContrast.test.ts` (every pair the kit paints), `noTextOpacity.test.ts`, `fontScaling.test.ts`, `reduceMotionCoverage.test.ts`, and `kitGallery.test.ts` (every part is in the gallery).
