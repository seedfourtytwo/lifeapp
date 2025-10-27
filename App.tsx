/**
 * Life Tracking App
 * Main entry point
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </PaperProvider>
  );
}
