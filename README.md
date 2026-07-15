# Life Dashboard

Local-first personal habit and counter tracker. Open the app → check off habits → log reps. Data stays on your phone.

> Previous activity-timer codebase is preserved at git tag `legacy-v1`.

## What ships in v1

| Feature | Description |
|---------|-------------|
| **Daily** | Active habits for today — view menu (all / remaining / by time) + optional sort |
| **Habits** | Check-off or timer mode, bundled meditation audio, schedules, reminders |
| **Counter** | Quick +buttons, undo, edit total, 14-day history chart |
| **Elements** | Create, edit, archive/restore, or delete habits and counters |
| **Settings → Data** | JSON export, import, and delete-all backup |
| **Offline SQLite** | All data on device — no account, no cloud |
| **Life Protocol v1** | Zod-validated elements + append-only events, JSON export/import |

**Primary target:** Android phone (Expo dev client). Web is dev-only.

## App structure

```
Home (default)
├── Daily tab      — active habits for today
├── Counter tab    — active counters
└── ⚙ Settings
    ├── Elements   — manage habits & counters (active + archive)
    └── App settings — theme, reminders, backup, about
```

### Elements: active vs archive

- **Active** counters and habits appear on Home (Daily / Counter tabs).
- **Archive** hides an item from Home but keeps its history.
- **Delete** removes the element and all events permanently.

## Tech stack

- Expo 54 + React Native + TypeScript (strict)
- expo-sqlite — local database
- Zod — protocol validation
- Zustand — UI state
- React Native Paper — Material UI
- Jest — unit tests (109+)

## Project structure

```
src/
├── protocol/       # Life Protocol v1 schemas (no React/SQLite)
├── db/             # SQLite client, migrations, repositories, export
├── kinds/          # counter + habit widgets and handlers
├── store/          # Zustand stores
├── screens/        # Home, Daily, Counters, Elements, Settings
├── hooks/          # Bootstrap, data refresh, timer controls, backup
├── audio/          # Timer sounds + completion chime (native)
└── navigation/     # Root stack navigator
```

## Getting started

```bash
npm install
npm start          # Expo dev server
npm run android    # Local dev client build (requires Android SDK + device)
npm run type-check
npm run lint
npm test
```

### GrapheneOS / dev client (recommended)

Install a **development** build once, then use Metro for JS updates:

```bash
eas build --platform android --profile development   # dev client + hot reload
eas build --platform android --profile preview       # standalone APK (no hot reload)
```

Connect Metro on LAN (phone and laptop on same network; VPN off):

```bash
CI=0 EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan --port 8081
```

Open the dev client and enter `http://<laptop-ip>:8081`.

### What needs a fresh dev build?

| Feature | Metro reload only | New dev/preview APK |
|---------|-------------------|---------------------|
| Habits, counters, archive, export, delete-all | ✓ | |
| Backup **import** (`expo-document-picker`) | | ✓ |
| Background timer audio, habit reminders | | ✓ |

After installing a new APK, reconnect to Metro for day-to-day JS changes.

## Life Protocol

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | What you track (`counter` or `habit` + config); optional `archivedAt` for soft-hide |
| **DashboardItem** | Sort order on Daily / Counter for **active** (non-archived) elements only |
| **Event** | Append-only fact (`value` + `timestamp` + optional `meta`) |

Kinds: `counter`, `habit`. Extend via `src/kinds/registry.ts` and `src/protocol/kinds/`.

Backup bundle: `src/db/export.ts` — elements, dashboard order, events, and app settings as JSON.

## License

MIT
