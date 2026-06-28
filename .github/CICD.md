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
# Installable APK for daily use
eas build --platform android --profile preview

# Dev client with hot reload
eas build --platform android --profile development

# Local build (no Expo cloud)
eas build --platform android --profile preview --local
```

## Legacy code

Pre-v2 app is tagged `legacy-v1` in git.
