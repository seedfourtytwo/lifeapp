# Life Dashboard

Local-first personal dashboard for Android — habits, counters, nutrition, todos, notes and journals.
Data stays in SQLite on the phone: no account, no cloud sync.

> Previous activity-timer codebase: git tag `legacy-v1`.

## What ships (1.5.0)

| Area | Notes |
|------|--------|
| **Home** | Habits / Counters / Nutrition / Todos tabs; optional weather chrome + calendar peek |
| **Habits** | Check-off or timer; streaks; drag-reorder |
| **Counters** | +/undo/edit total; optional daily target + streak; drag-reorder; daily reset |
| **Nutrition** | Food catalog (protocol *catalog*, not a kind) + day log; weekly distinct-plant count |
| **Todos** | Open list with due dates + drag-reorder; completed rows kept as history |
| **Trackers** | Create, edit, archive/restore, delete; curated icons |
| **Notes / journals** | Per-tracker day notes + journal notebooks; on-device mic dictation |
| **Calendar** | Local events, recurrence, reminders (ambient — not a protocol kind) |
| **Weather** | Mood chip + forecast strip (ambient); coarse location only |
| **Insights** | Cross-tracker charts over event history |
| **Settings → Data** | JSON export/import; granular Clear data… |
| **i18n** | English + French (Todos strings are English-only, served to FR via fallback) |
| **Life Protocol v1** | Zod-validated elements + events |

**DB schema:** v21. Milestones: v12 lean wipe · v13 day notes · v14 daily journals ·
v15 note share state · v16–v18 journal notebooks · v19–v20 food catalog · v21 todos.
The authoritative value is `CURRENT_SCHEMA_VERSION` in [`src/db/migrations.ts`](src/db/migrations.ts).

**Primary target:** Android phone. Web is for occasional desktop checks only.

## App structure

```
Home (default)
├── Habits tab
├── Counters tab
├── Nutrition tab — this week's plate
├── Todos tab
├── Ambient chrome — weather + calendar peek (optional in Settings)
└── More
    ├── Insights — charts over event history
    ├── Journal — notebooks, dated feed
    ├── Calendar — month browse / edit
    ├── Trackers — manage habits & counters (active + archive)
    ├── Ingredients — build the food catalogue (virtualised list)
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
├── nutrition/      # Food catalog domain (a catalog, not a kind)
├── db/             # SQLite client, migrations, repositories, export
├── kinds/          # counter + habit widgets / handlers
├── store/          # Zustand
├── screens/
├── components/
├── notes/          # Note + journal editor sheet and persistence
├── dictation/      # On-device Moonshine ASR session
├── hooks/
├── i18n/           # en + fr catalogs
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

### Cutting a release

`app.json` → `expo.version` + `expo.android.versionCode` is the **single source of
truth**. Never edit either by hand:

```bash
npm run release -- patch      # 1.5.0 -> 1.5.1, versionCode 24 -> 25
```

Also accepts `minor`, `major`, an explicit `x.y.z`, and `--dry-run`. It bumps
`versionCode` on every release (the Play Store rejects a reused one) and syncs
`package.json`. `getAppVersion()` reads the bundled `app.json`, so the About
screen cannot drift. `__tests__/appVersion.test.ts` fails CI if the copies
disagree.

A versionCode change is native — rebuild the release APK, don't just reload Metro.

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
Food and todos are **catalogs / app data**, also outside `ElementKind`.

## Planning docs

| Doc | Role |
|-----|------|
| [`.cursor/roadmap.md`](.cursor/roadmap.md) | Active next work + session briefs |
| [`.cursor/product-ideas.md`](.cursor/product-ideas.md) | Parking lot (intent only) |
| [`.cursor/protocol-plan.md`](.cursor/protocol-plan.md) | Trackers vs catalogs vs ambient; export shapes |
| [`.cursor/calendar-plan.md`](.cursor/calendar-plan.md) | Calendar decisions + Later |
| [`.cursor/todos-plan.md`](.cursor/todos-plan.md) | Todos decisions |
| [`.cursor/rules/`](.cursor/rules/) | Agent / contributor conventions |

## License

MIT
