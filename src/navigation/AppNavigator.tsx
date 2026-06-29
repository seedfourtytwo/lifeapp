import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import type { RootStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import SettingsMenuScreen from '../screens/SettingsMenuScreen';
import ElementsScreen from '../screens/ElementsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ElementHistoryScreen from '../screens/ElementHistoryScreen';

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
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="Elements"
        component={ElementsScreen}
        options={{ title: 'Elements' }}
      />
      <Stack.Screen
        name="AppSettings"
        component={SettingsScreen}
        options={{ title: 'App settings' }}
      />
      <Stack.Screen
        name="ElementHistory"
        component={ElementHistoryScreen}
        options={{ title: 'History' }}
      />
    </Stack.Navigator>
  );
}
