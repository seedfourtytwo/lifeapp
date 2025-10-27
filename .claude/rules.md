# Life Tracking App - Development Guidelines

## Project Overview

This is a local-first life tracking mobile app built with React Native + Expo. The app helps users track daily activities (meditation, cooking, workout, reading, etc.) with timer functionality and statistics visualization.

**Key Principles:**
- Local-first: All data stored on device using AsyncStorage
- Offline-first: Works completely offline
- Simple & maintainable: Easy to add new features
- TypeScript everywhere: Type safety is mandatory

---

## Architecture

### Stack
- **Framework**: React Native with Expo SDK 51+
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand (simple, lightweight)
- **Navigation**: React Navigation
- **Storage**: AsyncStorage (JSON-based local storage)
- **UI**: React Native Paper (Material Design)
- **Icons**: Material Community Icons (via react-native-paper)

### Folder Structure

```
src/
├── components/       # Reusable UI components
├── screens/         # Screen components (one per route)
├── services/        # Business logic & storage
├── hooks/           # Custom React hooks
├── store/           # Zustand stores
├── types/           # TypeScript type definitions
├── utils/           # Helper functions
└── constants/       # App constants (colors, themes, etc.)
```

---

## Code Style & Conventions

### TypeScript

1. **Always use TypeScript**
   - No `any` types (use `unknown` if truly unknown)
   - Properly type all function parameters and return values
   - Use interfaces for object shapes
   - Use type aliases for unions/primitives

```typescript
// ✅ Good
interface Props {
  activityId: string;
  onPress: (id: string) => void;
}

// ❌ Bad
interface Props {
  activityId: any;
  onPress: Function;
}
```

2. **Strict null checks**
   - Always handle null/undefined cases
   - Use optional chaining (`?.`) and nullish coalescing (`??`)

```typescript
// ✅ Good
const name = activity?.name ?? 'Unknown';

// ❌ Bad
const name = activity.name;
```

### Components

1. **Functional components only**
   - Use React hooks (no class components)
   - Keep components small and focused (< 200 lines)

2. **Component naming**
   - PascalCase for component files: `ActivityButton.tsx`
   - Export default for components
   - Props interface named `{ComponentName}Props`

```typescript
// ActivityButton.tsx
interface ActivityButtonProps {
  activity: Activity;
  onPress: () => void;
  isActive?: boolean;
}

export default function ActivityButton({ activity, onPress, isActive = false }: ActivityButtonProps) {
  // Component code
}
```

3. **Component organization**

```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

// 2. Types/Interfaces
interface Props { }

// 3. Component
export default function Component(props: Props) {
  // 3a. Hooks
  const [state, setState] = useState();

  // 3b. Effects
  useEffect(() => { }, []);

  // 3c. Handlers
  const handlePress = () => { };

  // 3d. Render helpers
  const renderItem = () => { };

  // 3e. Return JSX
  return <View />;
}

// 4. Styles (if using StyleSheet)
const styles = StyleSheet.create({ });
```

### Hooks

1. **Custom hooks**
   - Prefix with `use`: `useActivityTimer.ts`
   - Extract reusable logic into custom hooks
   - Return objects (not arrays) for clarity

```typescript
// ✅ Good
export function useActivityTimer() {
  return {
    isRunning,
    elapsedSeconds,
    start,
    stop,
    pause,
  };
}

// ❌ Bad (array destructuring is confusing)
export function useActivityTimer() {
  return [isRunning, elapsedSeconds, start, stop, pause];
}
```

2. **Hook dependencies**
   - Always specify dependencies correctly
   - Use ESLint exhaustive-deps rule

### State Management (Zustand)

1. **Create focused stores**
   - One store per domain (activities, tracking, settings)
   - Keep stores small and focused

```typescript
// activityStore.ts
import { create } from 'zustand';

interface ActivityStore {
  activities: Activity[];
  loadActivities: () => Promise<void>;
  addActivity: (activity: Activity) => Promise<void>;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  activities: [],
  loadActivities: async () => {
    const activities = await getActivities();
    set({ activities });
  },
  addActivity: async (activity) => {
    await addActivity(activity);
    // Reload from storage (source of truth)
    const activities = await getActivities();
    set({ activities });
  },
}));
```

2. **Storage is source of truth**
   - Always read from AsyncStorage after mutations
   - Don't rely on in-memory state being in sync

---

## Data & Storage

### Local-First Principles

1. **AsyncStorage is the database**
   - All data stored as JSON strings
   - Use the `storageService.ts` for all storage operations
   - Never call AsyncStorage directly from components

2. **Data flow**
   ```
   Component → Hook → Store → Service → AsyncStorage
   ```

3. **Keep data small**
   - Periodically archive old sessions (> 6 months)
   - Don't store large files in AsyncStorage

### Error Handling

1. **Always handle errors**
   ```typescript
   try {
     await storageService.saveActivity(activity);
   } catch (error) {
     console.error('Failed to save activity:', error);
     // Show user-friendly error message
     Alert.alert('Error', 'Failed to save activity. Please try again.');
   }
   ```

2. **Graceful degradation**
   - If data load fails, show empty state (not crash)
   - Provide retry mechanisms

---

## Performance

### React Native Optimization

1. **Memoization**
   - Use `React.memo()` for expensive components
   - Use `useMemo()` for expensive calculations
   - Use `useCallback()` for event handlers passed to children

```typescript
const MemoizedActivityButton = React.memo(ActivityButton);

const handlePress = useCallback(() => {
  console.log('pressed');
}, []);
```

2. **Lists**
   - Use `FlatList` for long lists (not ScrollView with map)
   - Implement `keyExtractor` and `getItemLayout`

3. **Images**
   - Use `Image.prefetch()` for critical images
   - Specify image dimensions to avoid layout shift

### Background Tasks

1. **Timer management**
   - Use `useEffect` cleanup for timers
   - Clear intervals/timeouts on unmount

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Update timer
  }, 1000);

  return () => clearInterval(interval);
}, []);
```

---

## UI/UX Guidelines

### Design System

1. **Use React Native Paper components**
   - Consistent Material Design
   - Built-in theming support
   - Accessible by default

2. **Colors**
   - Define colors in `src/constants/theme.ts`
   - Use theme colors (not hardcoded values)

```typescript
// ✅ Good
<Text style={{ color: theme.colors.primary }}>

// ❌ Bad
<Text style={{ color: '#4CAF50' }}>
```

3. **Spacing**
   - Use consistent spacing scale: 4, 8, 16, 24, 32
   - Define spacing constants

### Accessibility

1. **Always add accessibility props**
   ```typescript
   <TouchableOpacity
     accessible={true}
     accessibilityLabel="Start meditation timer"
     accessibilityRole="button"
   >
   ```

2. **Test with screen reader**
   - Enable TalkBack (Android) / VoiceOver (iOS)
   - Ensure all interactive elements are accessible

---

## Testing

### Strategy

1. **Types are tests**
   - TypeScript catches many bugs at compile time
   - Properly type everything

2. **Manual testing priority**
   - Test on real device (not just simulator)
   - Test offline scenarios
   - Test background/foreground transitions

3. **Future: Automated tests**
   - Use Jest + React Native Testing Library
   - Focus on business logic in services
   - E2E tests with Detox (when mature)

---

## Git Workflow

### Commit Messages

Use conventional commits:

```
feat: Add activity editing functionality
fix: Resolve timer not stopping on app close
refactor: Extract storage logic into service
docs: Update README with setup instructions
chore: Update dependencies
```

### Branches

```
main          → Production-ready code
develop       → Integration branch
feature/xyz   → New features
fix/xyz       → Bug fixes
```

### Before Committing

1. **Check TypeScript**
   ```bash
   npx tsc --noEmit
   ```

2. **Format code** (add Prettier later)
   ```bash
   npx prettier --write .
   ```

3. **Test the app**
   - Run on device
   - Test critical flows

---

## Deployment

### Build Process (Expo EAS)

1. **Configure EAS**
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   ```

2. **Build for Android**
   ```bash
   eas build --platform android --profile preview
   ```

3. **Build for production**
   ```bash
   eas build --platform android --profile production
   ```

### Release Checklist

- [ ] Update version in `app.json`
- [ ] Test on physical device
- [ ] Check all features work offline
- [ ] Test background timer functionality
- [ ] Test notifications (if implemented)
- [ ] Create build with EAS
- [ ] Test APK on device before publishing
- [ ] Upload to Google Play Console (internal testing first)

---

## Security & Privacy

### Data Privacy

1. **Local-only data**
   - All data stays on device
   - No analytics/tracking (privacy-first)
   - Clear this in app description

2. **Future cloud sync**
   - If adding cloud sync, make it opt-in
   - Encrypt sensitive data
   - GDPR compliance

### API Keys

1. **Never commit secrets**
   - Use `.env` files (git ignored)
   - Use Expo SecureStore for sensitive data

---

## Feature Development

### Adding New Features

1. **Plan first**
   - Sketch UI mockups
   - Define data models in `types/index.ts`
   - Update storage service if needed

2. **Implement incrementally**
   - Start with data layer (types, storage)
   - Then business logic (hooks, stores)
   - Finally UI (components, screens)

3. **Test thoroughly**
   - Test on real device
   - Test offline
   - Test edge cases (empty states, errors)

### Common Patterns

**Adding a new activity property:**

1. Update type in `src/types/index.ts`
2. Update storage service if needed
3. Handle migration (old data compatibility)
4. Update UI components
5. Test data persistence

**Adding a new screen:**

1. Create screen component in `src/screens/`
2. Add route to navigation
3. Add navigation types
4. Link from existing screens

---

## Troubleshooting

### Common Issues

1. **AsyncStorage not persisting**
   - Check you're using `await`
   - Verify storage keys are correct
   - Clear storage and retry: `storageService.clearAllData()`

2. **App crashes on startup**
   - Check TypeScript errors: `npx tsc --noEmit`
   - Clear Metro cache: `expo start -c`
   - Reinstall deps: `rm -rf node_modules && npm install`

3. **Timer not working in background**
   - Use `expo-task-manager` for background tasks
   - Test on physical device (simulators behave differently)

---

## Resources

### Documentation
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Zustand](https://github.com/pmndrs/zustand)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

### Tools
- [TypeScript Playground](https://www.typescriptlang.org/play)
- [React DevTools](https://react-native.rocketseat.dev/)
- [Expo Snack](https://snack.expo.dev/) - Test code snippets

---

## Questions?

When in doubt:
1. **Keep it simple** - Don't over-engineer
2. **Local-first** - Data stays on device
3. **Type everything** - TypeScript is your friend
4. **Test on device** - Simulators lie
5. **Read the docs** - Official docs are your best resource
