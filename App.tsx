import React, { useEffect, useState } from 'react';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { ActivityIndicator, PaperProvider, adaptNavigationTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import './src/i18n';
import { applyAppLanguage } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useCalendarReminderSync } from './src/hooks/useCalendarReminderSync';
import { useSettingsStore } from './src/store/settingsStore';
import { getAppTheme } from './src/theme';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

function ThemedApp() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const [languageReady, setLanguageReady] = useState(false);

  useAppBootstrap();
  useCalendarReminderSync();

  useEffect(() => {
    if (!isLoaded) {
      setLanguageReady(false);
      return;
    }
    let cancelled = false;
    void applyAppLanguage(appLanguage).finally(() => {
      if (!cancelled) setLanguageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [appLanguage, isLoaded]);

  if (!isLoaded || !languageReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const paperTheme = getAppTheme(themeMode);
  const navigationTheme = themeMode === 'dark' ? DarkTheme : LightTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer theme={navigationTheme}>
        <AppNavigator />
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
