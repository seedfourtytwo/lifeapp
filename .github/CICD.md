# CI/CD

## CI (`.github/workflows/ci.yml`)

Runs on push/PR to `main` and `develop`:

1. ESLint
2. TypeScript (`npm run type-check`)
3. Jest (`npm test`)
4. `expo-doctor`

### Local checks

```bash
npm run type-check
npm run lint
npm run lint:fix
npm test
```

## Android builds (GrapheneOS-friendly)

Expo Go may not work on GrapheneOS. Use EAS builds:

```bash
# Dev client — hot reload via Metro; required for backup import testing
eas build --platform android --profile development

# Standalone APK for daily use (no Metro)
eas build --platform android --profile preview

# Local EAS build (no Expo cloud queue)
eas build --platform android --profile preview --local
```

Cancel a queued cloud build: `eas build:cancel`.

After a new **development** APK is installed, start Metro with `--dev-client --lan` and open `http://<laptop-ip>:8081` on the phone.

## Legacy code

Pre-v2 app is tagged `legacy-v1` in git.
