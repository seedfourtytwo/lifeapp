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
- Stores that mirror SQLite blank themselves through `reset()` (`src/store/mirrorReset.ts`);
  nothing blanks another store's fields from outside.
- DB writes go through `withGuardedWrite(scope, …)` (`src/db/dataGeneration.ts`): it takes
  the write lock and abandons the write if an import/clear replaced that scope.
- Do not scaffold future protocol/DB features early.
- Phone-first Android; web is secondary.

## Checks

```bash
npm test
npm run type-check
npm run lint
```

## Legacy

Pre-v2 code: `git tag legacy-v1`
