# Life Dashboard

Local-first daily tracker for habits and counters. Open the app → check off habits → log reps. That's it.

> Previous activity-timer codebase is preserved at git tag `legacy-v1`.

## What ships today

| Feature | Description |
|---------|-------------|
| **Daily** | Habit checklist grouped by time of day, with optional scheduled visibility windows |
| **Counter** | Log reps with quick +buttons, undo, edit total, and 14-day history |
| **Elements** | Create and edit habits and counters (gear icon → Elements) |
| **Offline SQLite** | All data stays on device |
| **Life Protocol v1** | Zod-validated elements and append-only events |

## App structure

```
Home (default)
├── Daily tab      — habits for today
├── Counter tab    — all counters (pinned sort to top)
└── ⚙ Settings
    ├── Elements   — manage habits & counters
    └── App settings
```

## Tech stack

- Expo 54 + React Native + TypeScript (strict)
- expo-sqlite — local database
- Zod — protocol validation
- Zustand — UI state
- React Native Paper — Material UI
- Jest — unit tests

## Project structure

```
src/
├── protocol/       # Life Protocol v1 schemas
├── db/             # SQLite client, migrations, repositories
├── kinds/          # Counter widget + kind registry
├── store/          # Zustand stores
├── screens/        # Home, Daily, Counters, Elements, Settings
├── components/     # Shared UI (editor dialog, charts)
└── navigation/     # Root stack navigator
```

## Getting started

```bash
npm install
npm start          # Expo dev server
npm run android    # Android device/emulator
npm run type-check
npm run lint
npm test
```

### GrapheneOS / no Expo Go

```bash
eas build --platform android --profile preview      # standalone APK
eas build --platform android --profile development  # dev client + hot reload
```

## Life Protocol

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | What you track (name, kind, config) |
| **DashboardItem** | Pin order for counters on the Counter tab |
| **Event** | Atomic log entry (value + timestamp) |

Kinds: `counter`, `habit`. Extend via `src/kinds/registry.ts` and `src/protocol/kinds/`.

JSON export/import API: `src/db/export.ts` (UI coming later).

## License

MIT
