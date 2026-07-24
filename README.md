# Life Dashboard

Local-first habit and counter tracker for Android. Data stays in SQLite on the phone — no account, no cloud sync.

> Previous activity-timer codebase: git tag `legacy-v1`.

## What ships (1.3.1)

| Area | Notes |
|------|--------|
| **Home** | Habits / Counters tabs; optional weather chrome + calendar peek |
| **Habits** | Check-off or timer; streaks; drag-reorder |
| **Counters** | +/undo/edit total; optional daily target + streak; drag-reorder; daily reset |
| **Trackers** | Create, edit, archive/restore, delete; curated icons |
| **Notes / journals** | Per-tracker day notes + daily journals; on-device mic dictation |
| **Calendar** | Local events, recurrence, reminders (ambient — not a protocol kind) |
| **Weather** | Mood chip + forecast strip (ambient); coarse location only |
| **Settings → Data** | JSON export/import; granular Clear data… |
| **i18n** | English + French |
| **Life Protocol v1** | Zod-validated elements + events |

**DB schema:** v14 (v12 wiped unused columns; v13 day notes; v14 daily journals).

**Primary target:** Android phone. Web is for occasional desktop checks only.

## App structure

```
Home (default)
├── Habits tab
├── Counters tab
├── Ambient chrome — weather + calendar peek (optional in Settings)
└── Settings
    ├── Trackers — manage habits & counters (active + archive)
    ├── Calendar — month browse / edit
    └── App settings — theme, language, widgets, backup, about
```

- **Active** trackers appear on Home.
- **Archive** hides from Home; history kept.
- **Delete** removes the element and its events.

## Tech stack

Expo 54 · React Native · TypeScript (strict) · expo-sqlite · Zod · Zustand · React Native Paper · Jest

## Project layout

```
src/
├── protocol/       # Life Protocol schemas (no React/SQLite)
├── calendar/       # Ambient calendar domain
├── weather/        # Ambient weather helpers
├── db/             # SQLite client, migrations, repositories, export
├── kinds/          # counter + habit widgets / handlers
├── store/          # Zustand
├── screens/
├── components/
├── hooks/
├── notifications/  # Local habit + calendar reminders
├── audio/          # Timer sounds + completion chime
└── navigation/
```

## Getting started

```bash
npm install
npm start
npm run android    # needs Android SDK + device
npm run type-check
npm run lint
npm test
```

### Android packages (side-by-side)

| Build | Package | Label | Use |
|-------|---------|-------|-----|
| Debug | `com.lifeapp.dashboard.dev` | **dev** | Coding + Metro |
| Release | `com.lifeapp.dashboard` | **prod** | Standalone (no Metro) |

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="$HOME/.local/jdk-21"   # if present

cd android && ./gradlew assembleDebug assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  --max-workers=2

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

On GrapheneOS prefer **Wireless debugging** (`adb pair` / `adb connect`) over USB file transfer.

```bash
CI=0 EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan --port 8081
```

Open **dev** → `http://<laptop-wifi-ip>:8081` (same Wi‑Fi; VPN off).

EAS cloud builds are optional when the local SDK is unavailable. Details: `.cursor/rules/android-build-workflow.mdc`, `.github/CICD.md`.

### When to rebuild the native APK

JS-only changes → Metro reload. New/changed native modules (clipboard, location, speech, audio, haptics, document picker, …) → new **dev** or **prod** APK.

## Life Protocol

| Concept | Purpose |
|---------|---------|
| **ElementDefinition** | Habit or counter + config; optional `archivedAt` |
| **DashboardItem** | Sort order for active elements on Home |
| **Event** | Append-only fact (`value` + `timestamp` + optional `meta`) |

Kinds today: `counter`, `habit`. Register new kinds in `src/kinds/registry.ts` only when UX truly diverges.

Weather and calendar are ambient — outside the kinds layer; calendar is an optional backup section.

## Planning docs

| Doc | Role |
|-----|------|
| [`.cursor/roadmap.md`](.cursor/roadmap.md) | Active next work + session briefs |
| [`.cursor/product-ideas.md`](.cursor/product-ideas.md) | Parking lot (intent only) |
| [`.cursor/calendar-plan.md`](.cursor/calendar-plan.md) | Calendar decisions + Later |
| [`.cursor/rules/`](.cursor/rules/) | Agent / contributor conventions |

## License

MIT
