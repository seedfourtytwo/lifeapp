/**
 * Life Dashboard
 * Main entry point
 */

import React, { useEffect } from 'react';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { ActivityIndicator, PaperProvider, adaptNavigationTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useSettingsStore } from './src/store/settingsStore';
import { appDarkTheme, appLightTheme } from './src/theme';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

function ThemedApp() {
  const darkMode = useSettingsStore((s) => s.darkMode);
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const paperTheme = darkMode ? appDarkTheme : appLightTheme;
  const navigationTheme = darkMode ? DarkTheme : LightTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
        <StatusBar style={darkMode ? 'light' : 'dark'} />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemedApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
