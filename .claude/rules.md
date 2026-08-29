# Life Dashboard — Development Guidelines

Local-first personal dashboard. SQLite is the source of truth; Zustand mirrors it. Trackable items follow **Life Protocol v1**.

Canonical conventions for agents: `.cursor/rules/` (especially `project-architecture.mdc`). Active plan: `.cursor/roadmap.md`.

## Stack

Expo SDK 54 · React Native · TypeScript (strict) · expo-sqlite · Zod · Zustand · React Native Paper · Jest

## Layers

1. **protocol/** — schemas; no React, no SQL
2. **repositories** — all SQL
3. **kinds** — kind-specific UI and aggregation (`counter`, `habit`); catalogs (e.g. `nutrition`) get their own domain folder
4. **stores** — reload after mutate
5. **screens** — thin composition

## Rules

- Events are append-only.
- Screens/stores never call `db.runAsync` directly.
- A new table is one entry in `PERSISTED_CONCEPTS` (`src/db/persistedConcepts.ts`) — DDL,
  repair, clear stance and bundle key. Schema, repair pass and clear all derive from it;
  the numbered `MIGRATIONS` ladder never does and stays hand-written.
- Stores that mirror SQLite blank themselves through `reset()` (`src/store/mirrorReset.ts`);
  nothing blanks another store's fields from outside.
- DB writes go through `withGuardedWrite(scope, …)` (`src/db/dataGeneration.ts`): it takes
  the write lock and abandons the write if an import/clear replaced that scope.
- Do not scaffold future protocol/DB features early.
- Phone-first Android; web is secondary.

## Appearance

Every rule here has a test that fails when it is broken — see the file named beside it.

- **Colour comes from theme tokens, and text is never dimmed with `opacity`.** The
  muted token already passes contrast; layering opacity on it lands near 2.2:1.
  Secondary text is `QuietText` (`src/components/QuietText.tsx`). Opacity is for
  whole-control state — pressed, disabled, a decorative wash.
  `themeContrast.test.ts`, `noTextOpacity.test.ts`
- **A new theme ships only once every pair it renders clears 4.5:1.** The table
  covers text on surfaces, labels on filled containers, and the accent, which
  tints real text and so is held to the text floor rather than 3:1.
  `themeContrast.test.ts`
- **`ThemeMode` is the stored preference and includes `system`; `ResolvedTheme` is
  what gets painted.** Anything keyed by theme takes the resolved one.
  `useAppTheme()` is the only place `resolveThemeMode` is called.
  `themeResolution.test.ts`
- **Anything animated consults `useReduceMotion`.** Ornament is skipped; motion
  that carries meaning keeps its end state through `springOrSnap` / `timingOrSnap`
  (`src/utils/motion.ts`). An exemption goes in the test's map, with its reason.
  `reduceMotionCoverage.test.ts`
- **Boxes holding text state `minHeight`, never `height`.** Cap a font multiplier
  only where growing would break the layout outright — a pinned badge, a dense
  axis — and never merely because text got bigger. `fontScaling.test.ts`
- **Spacing from `space`, corners from `deco.radius`** (`src/theme/spacing.ts`,
  `src/theme/decorations.ts`). A literal radius is for geometry only, where the
  value is half the height and that is what makes the shape a circle or capsule.
- **Type roles come from `src/theme/typography.ts`:** the display face for what a
  screen is about, the mono face for quantities. Body text stays on the system
  font deliberately — do not add a body webfont.

## Checks

```bash
npm test
npm run type-check
npm run lint
```

## Legacy

Pre-v2 code: `git tag legacy-v1`
