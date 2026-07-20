# Life Dashboard

Local-first personal habit and counter tracker. Open the app → check off habits → log reps. Data stays on your phone.

> Previous activity-timer codebase is preserved at git tag `legacy-v1`.

## What ships in v1.2

| Feature | Description |
|---------|-------------|
| **Clean SQLite schema** | Dropped unused columns (`category`, `parent_id`, `overrides`); schema v12 **wipes local data** on upgrade |
| **Home** | Dashboard with Habits / Counters tabs; ambient weather + calendar bubble |
| **Habits** | Today's check-offs or timers — remaining progress, sort, reorder |
| **Counters** | Quick +buttons, undo, edit total, reorder, 14-day history; totals reset daily |
| **Calendar** | Local events, recurrence, reminders, per-occurrence Done (ambient — not a protocol kind) |
| **Weather** | Optional forecast chip on Home (ambient — not a protocol kind) |
| **Trackers** | Create, edit, archive/restore, or delete habits and counters |
| **Settings → Data** | JSON export/import; granular **Clear data…** (history by period, calendar, cache, prefs, or definitions) |
| **Offline SQLite** | All data on device — no account, no cloud |
| **Life Protocol v1** | Zod-validated elements + events (day aggregates may replace prior events for the same date) |

**Primary target:** Android phone (Expo dev client). Web is dev-only.

## App structure

```
Home (default)
├── Habits tab     — active habits for today
├── Counters tab   — active counters (today's totals; reset at midnight)
├── Ambient bubble — weather + calendar fan-out (optional in Settings)
└── ⚙ Settings
    ├── Trackers   — manage habits & counters (active + archive)
    ├── Calendar   — full month browse / edit
    └── App settings — theme, reminders, weather/calendar toggles, backup, about
```

### Trackers: active vs archive

- **Active** counters and habits appear on Home (Habits / Counters tabs).
- **Archive** hides an item from Home but keeps its history.
- **Delete** removes the element and all events permanently.

## Tech stack

- Expo 54 + React Native + TypeScript (strict)
- expo-sqlite — local database
- Zod — protocol validation
- Zustand — UI state
- React Native Paper — Material UI
- Jest — unit tests (150)

## Project structure

```
src/
├── protocol/       # Life Protocol v1 schemas (no React/SQLite)
├── calendar/       # Ambient calendar domain (types, RRULE, occurrences)
├── weather/        # Ambient weather helpers
├── db/             # SQLite client, migrations, repositories, export
├── kinds/          # counter + habit widgets and handlers
├── store/          # Zustand stores
├── screens/        # Home, Habits, Counters, Calendar, Trackers, Settings
├── components/     # Home chrome bubble, peek sheets, shared UI
├── hooks/          # Bootstrap, reminder sync, timer, backup
├── notifications/  # Habit + calendar local notifications (native/web)
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
| Local calendar (no new native modules) | ✓ | |
| Backup **import** (`expo-document-picker`) | | ✓ |
| Background timer audio, habit reminders | | ✓ |
| Weather phone location (`expo-location`) | | ✓ |
| Habit complete haptics (`expo-haptics`) | | ✓ |

After installing a new APK, reconnect to Metro for day-to-day JS changes.

## Life Protocol

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | What you track (`counter` or `habit` + config); optional `archivedAt` for soft-hide |
| **DashboardItem** | Sort order on Habits / Counters for **active** (non-archived) elements only |
| **Event** | Append-only fact (`value` + `timestamp` + optional `meta`) |

Kinds: `counter`, `habit`. Extend via `src/kinds/registry.ts` and `src/protocol/kinds/`.

**Ambient features** (weather, calendar) live outside the protocol kinds layer; calendar is an optional section on the backup bundle (`src/db/export.ts`).

## License

MIT
