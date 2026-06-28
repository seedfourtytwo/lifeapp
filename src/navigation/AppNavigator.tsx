import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { colors } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import SettingsMenuScreen from '../screens/SettingsMenuScreen';
import ElementsScreen from '../screens/ElementsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ElementHistoryScreen from '../screens/ElementHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
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
