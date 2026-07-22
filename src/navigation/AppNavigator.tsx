import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import SettingsMenuScreen from '../screens/SettingsMenuScreen';
import TrackersScreen from '../screens/TrackersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TrackerHistoryScreen from '../screens/TrackerHistoryScreen';
import InsightsScreen from '../screens/InsightsScreen';
import JournalScreen from '../screens/JournalScreen';
import CalendarScreen from '../screens/CalendarScreen';
import CalendarEventEditorScreen from '../screens/CalendarEventEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          ...(isCartoon
            ? {
                borderBottomWidth: deco.headerBorderWidth,
                borderBottomColor: theme.colors.outline,
              }
            : {}),
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontWeight: 'bold',
          color: theme.colors.onSurface,
        },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SettingsMenu"
        component={SettingsMenuScreen}
        options={{ title: 'More' }}
      />
      <Stack.Screen
        name="Trackers"
        component={TrackersScreen}
        options={{ title: 'Trackers' }}
      />
      <Stack.Screen
        name="AppSettings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="TrackerHistory"
        component={TrackerHistoryScreen}
        options={{ title: 'History' }}
      />
      <Stack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ title: 'Insights' }}
      />
      <Stack.Screen
        name="Journal"
        component={JournalScreen}
        options={{ title: 'Journal' }}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
      <Stack.Screen
        name="CalendarEventEditor"
        component={CalendarEventEditorScreen}
        getId={({ params }) =>
          params?.eventId ?? `new-${params?.seedDate ?? 'blank'}`
        }
        options={({ route }) => ({
          title: route.params?.eventId ? 'Edit event' : 'New event',
        })}
      />
    </Stack.Navigator>
  );
}
