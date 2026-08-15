import React from 'react';
import { Appbar, useTheme } from 'react-native-paper';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, SettingsStackParamList } from './types';
import { useStackScreenOptions } from './useStackScreenOptions';
import AppSettingsScreen from '../screens/settings/AppSettingsScreen';
import WeatherLocationScreen from '../screens/settings/WeatherLocationScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  const theme = useTheme();
  const screenOptions = useStackScreenOptions();
  const { t } = useTranslation('settings');

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AppSettingsHome"
        component={AppSettingsScreen}
        options={({ navigation }) => ({
          title: t('menu.settingsTitle'),
          headerLeft: () => (
            <Appbar.BackAction
              color={theme.colors.primary}
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<RootStackParamList>>()
                  ?.goBack()
              }
              accessibilityLabel={t('menu.backA11y')}
            />
          ),
        })}
      />
      <Stack.Screen
        name="WeatherLocation"
        component={WeatherLocationScreen}
        options={{ title: t('weather.locationTitle') }}
      />
    </Stack.Navigator>
  );
}
