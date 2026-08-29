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
import { useFonts } from 'expo-font';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import './src/i18n';
import { applyAppLanguage } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { useAppBootstrap } from './src/hooks/useAppBootstrap';
import { useCalendarReminderSync } from './src/hooks/useCalendarReminderSync';
import { useEveningCheckInSync } from './src/hooks/useEveningCheckInSync';
import { useAppTheme } from './src/hooks/useAppTheme';
import { useSettingsStore } from './src/store/settingsStore';
import { getAppTheme } from './src/theme';

const { LightTheme, DarkTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
  reactNavigationDark: NavigationDarkTheme,
});

function ThemedApp() {
  const { themeMode } = useAppTheme();
  const appLanguage = useSettingsStore((s) => s.appLanguage);
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const [languageReady, setLanguageReady] = useState(false);

  /**
   * The display and data faces (see `src/theme/typography.ts`). Body text stays
   * on the system font, so a failure here costs the two accent faces and
   * nothing else — hence `fontError` releases the gate rather than blocking it.
   * Waiting forever for a font would be a worse outcome than falling back.
   */
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useAppBootstrap();
  useCalendarReminderSync();
  useEveningCheckInSync();

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

  if (!isLoaded || !languageReady || !(fontsLoaded || fontError)) {
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
