# Life Dashboard

**v1.0 = a simple push-up counter.** Open the app, tap +5 or +10, see today's total. That's it.

The architecture (protocol, SQLite, kind registry) is ready to grow later — but v1 ships only counters, starting with push-ups seeded on first launch.

> Previous activity-timer codebase is preserved at git tag `legacy-v1`.

## v1.0 scope

| In v1 | Not in v1 |
|-------|-----------|
| Dashboard with push-up widget (+5 / +10) | Charts / graphs |
| Today's rep total | Tick / checkbox habits |
| Edit push-up quick buttons (Elements tab) | Time-of-day templates |
| Create additional counters (optional) | Gamification / points |
| Offline SQLite storage | Export UI |
| | Multiple element kinds |

## Product vision (after v1)

**Today:** Open the app → land on your **dashboard** → tap +5 push-ups → done.

**Where this is going** (documented intent — not implemented until each phase ships):

| Phase | What |
|-------|------|
| Now | Counter elements (push-ups), pin to dashboard |
| Next | Tick habits — e.g. mark "daily reading" done for the day |
| Soon | Charts — daily/weekly graphs per element |
| Later | Time-aware dashboard — morning vs evening widgets |
| Later | Daily templates — reusable layouts (weekday vs weekend) |
| Later | Gamification — points computed from events |
| Later | Timed habits, food quantity, sub-elements (routines) |

Add protocol schemas, DB tables, and UI **only when you build that phase** — not ahead of time.

## Features (v1.0)

- **Dashboard** (home screen) — pinned widgets; tap +5 / +10 to log reps
- **Elements** — create and edit counter elements; pin/unpin from dashboard
- **Life Protocol v1** — Zod-validated element definitions and events
- **SQLite storage** — offline, on-device, indexed for future charts
- **JSON export/import** — backup API ready (`src/db/export.ts`), UI coming later

## Tech Stack

- Expo 54 + React Native + TypeScript (strict)
- expo-sqlite — local database
- Zod — protocol validation
- Zustand — UI state
- React Native Paper — Material UI
- Jest — unit tests

## Project Structure

```
src/
├── protocol/       # Life Protocol v1 schemas (no UI, no SQL)
├── db/             # SQLite client, migrations, repositories
├── kinds/          # Element kind handlers + widgets
├── store/          # Zustand stores
├── screens/        # Dashboard, Elements
└── navigation/
```

## Getting Started

```bash
npm install
npm start          # Expo dev server
npm run android    # Android device/emulator
npm run type-check
npm run lint
npm test
```

### GrapheneOS / no Expo Go

Build an installable APK:

```bash
eas build --platform android --profile preview
```

Or a development client for hot reload:

```bash
eas build --platform android --profile development
```

## Life Protocol

Three concepts:

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | What you track (name, kind, config) |
| **DashboardItem** | Pinned widget on home screen |
| **Event** | Atomic log entry (value + timestamp) |

Kinds are extensible via `src/kinds/registry.ts`. **Only `counter` exists in code today.**

## Roadmap

- [ ] Tick habits (new kind + widget when ready)
- [ ] Charts
- [ ] Dashboard reorder
- [ ] Time-of-day visibility on dashboard items
- [ ] Daily / weekly templates
- [ ] Gamification over events
- [ ] Export/import UI

## License

MIT
