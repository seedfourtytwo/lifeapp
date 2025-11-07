# CI/CD Documentation

This project uses GitHub Actions for continuous integration. Builds are done locally (no cloud services required).

## CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

### What it does:
1. **Lint & Type Check**: Runs ESLint and TypeScript type checking
2. **Test**: Runs tests (if configured)
3. **Validate**: Validates Expo configuration

### Local Testing

You can test CI checks locally:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## Building for Production (Local)

This project builds locally without cloud services. No GitHub secrets or Expo accounts needed!

### Prerequisites

- **Android**: Android Studio with Android SDK installed
- **iOS**: Xcode (macOS only) with Apple Developer account

### Building Android APK Locally

1. **Install EAS CLI** (for local builds):
   ```bash
   npm install -g eas-cli
   ```

2. **Build locally**:
   ```bash
   # Preview build (APK)
   eas build --platform android --profile preview --local
   
   # Production build (AAB for Play Store)
   eas build --platform android --profile production --local
   ```

3. **Find your build**:
   - APK/AAB will be in the `builds/` directory
   - Or check the output path shown after build completes

### Building iOS Locally

```bash
# Preview build
eas build --platform ios --profile preview --local

# Production build (requires Apple Developer account)
eas build --platform ios --profile production --local
```

### Alternative: Using Expo Prebuild + Native Builds

If you prefer not to use EAS CLI at all:

```bash
# Generate native Android/iOS folders
npx expo prebuild

# Build Android
cd android
./gradlew assembleRelease  # APK
./gradlew bundleRelease     # AAB

# Build iOS (macOS only)
cd ios
xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -configuration Release
```

## EAS Configuration

The `eas.json` file configures build profiles for local builds:
- **development**: For development builds with Expo Dev Client
- **preview**: For internal testing (APK for Android)
- **production**: For app store releases (AAB for Android)

Note: These profiles work with `--local` flag, no cloud account needed!

## Workflow Status

Check workflow status:
- In the GitHub Actions tab
- Via badges in README (optional)

## Why Local Builds?

- ✅ No cloud service dependencies
- ✅ Full control over build process
- ✅ No account setup required
- ✅ Works offline
- ✅ Privacy-focused (no data sent to cloud)

