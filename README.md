# Life Dashboard

Local-first personal habit and counter tracker. Open the app → check off habits → log reps. Data stays on your phone.

> Previous activity-timer codebase is preserved at git tag `legacy-v1`.

## What ships in v1

| Feature | Description |
|---------|-------------|
| **Daily** | Pinned habits grouped by time of day, filters, optional streak badges |
| **Habits** | Check-off or timer mode, bundled meditation audio, schedules, reminders |
| **Counter** | Quick +buttons, undo, edit total, 14-day history chart |
| **Elements** | Create, edit, pin/unpin habits and counters |
| **Offline SQLite** | All data on device — no account, no cloud |
| **Life Protocol v1** | Zod-validated elements + append-only events, JSON export/import |

**Primary target:** Android phone (Expo dev client). Web is dev-only.

## App structure

```
Home (default)
├── Daily tab      — habits for today
├── Counter tab    — pinned counters
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
- Jest — unit tests (95+)

## Project structure

```
src/
├── protocol/       # Life Protocol v1 schemas (no React/SQLite)
├── db/             # SQLite client, migrations, repositories, export
├── kinds/          # counter + habit widgets and handlers
├── store/          # Zustand stores
├── screens/        # Home, Daily, Counters, Elements, Settings
├── hooks/          # Bootstrap, data refresh, timer controls
├── audio/          # Timer sounds + completion chime (native)
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

### GrapheneOS / dev client (recommended)

```bash
eas build --platform android --profile development  # dev client + hot reload
eas build --platform android --profile preview      # standalone APK
```

Metro on LAN:

```bash
CI=0 EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan --port 8081
```

## Life Protocol

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | What you track (`counter` or `habit` + config) |
| **DashboardItem** | Pin order on Daily / Counter tabs |
| **Event** | Append-only fact (`value` + `timestamp` + optional `meta`) |

Kinds: `counter`, `habit`. Extend via `src/kinds/registry.ts` and `src/protocol/kinds/`.

JSON export/import: `src/db/export.ts` (Settings UI can wire this later).

## License

MIT
