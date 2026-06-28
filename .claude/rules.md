# Life Dashboard — Development Guidelines

## Overview

Local-first personal dashboard. Trackable items follow **Life Protocol v1**. SQLite is the source of truth; Zustand mirrors it in memory.

**Principles:** privacy, offline-first, protocol-driven extensibility, strict TypeScript.

## Stack

- Expo SDK 54, React Native, TypeScript (strict)
- expo-sqlite, Zod, Zustand, React Native Paper
- Jest for protocol and kind logic tests

## Folder Structure

```
src/
├── protocol/           # Schemas, types — no React, no SQL
├── db/                 # Migrations, repositories, export
├── kinds/              # Per-kind handlers + dashboard widgets
├── store/              # Zustand
├── screens/
└── navigation/
```

## Architecture Rules

1. **Protocol layer** validates all external and persisted structured data.
2. **Repositories** own all SQL. Screens and stores call repositories, never `db.runAsync` directly.
3. **Kind handlers** own kind-specific UI and aggregation logic.
4. **Events are append-only.** Corrections = new events or a dedicated undo flow later.
5. **Reload after mutate:** stores call `load()` after repository writes.

## Adding an Element Kind

1. `src/protocol/kinds/<kind>.ts` — Zod config schema
2. Extend `ElementKindSchema` in `src/protocol/element.ts`
3. `src/kinds/<kind>/` — handler + widget
4. Register in `src/kinds/registry.ts`

## Testing

```bash
npm test              # Jest
npm run type-check    # tsc
npm run lint
```

Test protocol parsing and pure functions without SQLite. Repository tests can use expo-sqlite mocks when needed.

## Legacy Code

Pre-v2 activity timer, stats, points, and features code: `git tag legacy-v1`

## Cursor Rules

See `.cursor/rules/` for AI-assisted development conventions.
