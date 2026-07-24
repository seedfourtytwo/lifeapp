# CI / CD

## CI (`.github/workflows/ci.yml`)

On push/PR to `main` and `develop`:

1. ESLint
2. TypeScript (`npm run type-check`)
3. Jest (`npm test`)
4. `expo-doctor`

```bash
npm run type-check
npm run lint
npm test
```

## Android builds (local default)

Expo Go is unreliable on GrapheneOS. Prefer a local SDK build:

| Profile | Gradle | Package | Label | Metro |
|---------|--------|---------|-------|-------|
| Dev client | `assembleDebug` | `com.lifeapp.dashboard.dev` | **dev** | Yes |
| Standalone | `assembleRelease` | `com.lifeapp.dashboard` | **prod** | No (JS embedded) |

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME="$HOME/.local/jdk-21"   # if present

cd android && ./gradlew assembleDebug assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  --max-workers=2

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/release/app-release.apk
```

Day-to-day JS: `CI=0 EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan --port 8081`.

Full notes: `.cursor/rules/android-build-workflow.mdc`.

## EAS (optional)

Use only if the local SDK is unavailable or you need a cloud APK link (free-plan quota applies):

```bash
npx eas-cli build --platform android --profile development   # dev client
npx eas-cli build --platform android --profile preview       # standalone APK
```

Cancel a queued cloud build: `eas build:cancel`.

## Legacy

Pre-v2 app: git tag `legacy-v1`.
