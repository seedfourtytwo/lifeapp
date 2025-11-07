# Life Tracking App

A simple, privacy-focused mobile app to track daily activities and build better habits. Track time spent on meditation, cooking, workouts, reading, and more - all stored locally on your device.

[![CI](https://github.com/seedfourtytwo/lifeapp/workflows/CI/badge.svg)](https://github.com/seedfourtytwo/lifeapp/actions)

## Features

- **Simple Activity Tracking**: Start/stop timers for different activities with one tap
- **Local-First**: All data stored on your device - works 100% offline
- **Statistics & Insights**: View daily, weekly, and monthly time breakdowns
- **Customizable Activities**: Add, edit, and customize your own activities
- **Gamification** (Future): Earn points for completing activities
- **Reminders** (Future): Get notified if you haven't done an activity

## Tech Stack

- **React Native** + **Expo** - Cross-platform mobile framework
- **TypeScript** - Type-safe development
- **AsyncStorage** - Local JSON-based storage
- **Zustand** - Lightweight state management
- **React Navigation** - Navigation
- **React Native Paper** - Material Design UI components

## Project Structure

```
lifeapp/
├── src/
│   ├── components/       # Reusable UI components
│   ├── screens/         # Screen components
│   ├── services/        # Business logic & storage
│   │   └── storageService.ts  # AsyncStorage wrapper
│   ├── hooks/           # Custom React hooks
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript definitions
│   │   └── index.ts     # Core data models
│   ├── utils/           # Helper functions
│   └── constants/       # App constants
├── .claude/
│   └── rules.md         # Development guidelines
├── App.tsx              # Entry point
└── package.json
```

## Data Architecture

### Local Storage (AsyncStorage)

All data is stored as JSON in AsyncStorage:

```typescript
// Activities
{
  "id": "uuid",
  "name": "Meditation",
  "color": "#4CAF50",
  "icon": "meditation",
  "points": 10
}

// Tracking Sessions
{
  "id": "uuid",
  "activityId": "uuid",
  "startTime": "2025-10-27T08:00:00Z",
  "endTime": "2025-10-27T08:30:00Z",
  "durationSeconds": 1800,
  "date": "2025-10-27"
}

// Active Session (currently running timer)
{
  "activityId": "uuid",
  "activityName": "Meditation",
  "startTime": "2025-10-27T09:00:00Z",
  "elapsedSeconds": 120
}
```

### Why Local-First?

- **Privacy**: Your data never leaves your device
- **Speed**: No network latency
- **Reliability**: Works offline always
- **Simple**: No backend, no authentication, no cloud costs
- **Future-proof**: Easy to add cloud sync later if needed

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- For Android: Android Studio or Expo Go app
- For iOS: Xcode (macOS only) or Expo Go app

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd lifeapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on your device:
   - **Android**: Press `a` in the terminal or scan QR with Expo Go
   - **iOS**: Press `i` in the terminal or scan QR with Expo Go

### Development Commands

```bash
npm start          # Start Expo development server
npm run android    # Run on Android emulator/device
npm run ios        # Run on iOS simulator/device (macOS only)
npm run web        # Run in web browser (for testing)
```

### TypeScript Check

```bash
npx tsc --noEmit   # Check for TypeScript errors
```

## Development Guidelines

See [`.claude/rules.md`](./.claude/rules.md) for comprehensive coding standards and best practices.

### Quick Tips

- **Always use TypeScript** - No `any` types
- **Functional components only** - Use React hooks
- **Storage is source of truth** - Always read from AsyncStorage after mutations
- **Keep components small** - Break down into smaller pieces
- **Test on real device** - Simulators can behave differently

## Roadmap

### Phase 1: MVP (Current)
- [x] Project setup with Expo + TypeScript
- [x] Data models and storage service
- [ ] Home screen with activity buttons
- [ ] Timer functionality (start/stop/pause)
- [ ] Basic activity management (add/edit/delete)

### Phase 2: Statistics
- [ ] Statistics screen with daily breakdown
- [ ] Weekly and monthly views
- [ ] Charts and visualizations
- [ ] Activity history

### Phase 3: Enhanced Features
- [ ] Background tracking (continue timer when app closed)
- [ ] Push notifications and reminders
- [ ] Gamification (points system)
- [ ] Streak tracking
- [ ] Daily goals

### Phase 4: Polish
- [ ] Dark mode
- [ ] Custom themes
- [ ] Data export/import
- [ ] iOS build and testing
- [ ] Play Store release

### Future Considerations
- [ ] Cloud sync (optional, opt-in)
- [ ] Widgets for quick tracking
- [ ] Apple Watch / Wear OS support
- [ ] Social features (share achievements)

## Building for Production

### Android (using EAS Build)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Login to Expo:
   ```bash
   eas login
   ```

3. Configure EAS Build:
   ```bash
   eas build:configure
   ```

4. Build APK for testing:
   ```bash
   eas build --platform android --profile preview
   ```

5. Build for Play Store:
   ```bash
   eas build --platform android --profile production
   ```

### iOS (Future)

Same process but with `--platform ios` (requires Apple Developer account).

## Data Management

### Backup Your Data

Export your data:
```typescript
import { exportAllData } from './src/services/storageService';

const backup = await exportAllData();
// Save backup string to file or share
```

### Restore from Backup

Import data:
```typescript
import { importAllData } from './src/services/storageService';

await importAllData(backupJsonString);
```

### Clear All Data

For testing or fresh start:
```typescript
import { clearAllData } from './src/services/storageService';

await clearAllData();
```

## Troubleshooting

### App won't start

```bash
# Clear Metro cache
expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

### AsyncStorage not persisting data

- Ensure you're using `await` with all storage operations
- Check storage keys are correct
- Try clearing storage and restarting

### TypeScript errors

```bash
# Check for errors
npx tsc --noEmit

# Often fixed by reinstalling
rm -rf node_modules
npm install
```

## Contributing

This is a personal project, but suggestions and ideas are welcome! Open an issue to discuss new features or improvements.

## License

MIT License - feel free to use this project as a template for your own apps.

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

---

Built with React Native + Expo | Local-first & Privacy-focused
