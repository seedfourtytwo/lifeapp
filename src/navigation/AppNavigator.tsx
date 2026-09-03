import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from './types';
import { useStackScreenOptions } from './useStackScreenOptions';
import HomeScreen from '../screens/HomeScreen';
import TrackersScreen from '../screens/TrackersScreen';
import IngredientsScreen from '../screens/IngredientsScreen';
import IngredientEditorScreen from '../screens/IngredientEditorScreen';
import SettingsNavigator from './SettingsNavigator';
import TrackerHistoryScreen from '../screens/TrackerHistoryScreen';
import InsightsScreen from '../screens/InsightsScreen';
import JournalScreen from '../screens/JournalScreen';
import TodoHistoryScreen from '../screens/TodoHistoryScreen';
import CalendarScreen from '../screens/CalendarScreen';
import CalendarEventEditorScreen from '../screens/CalendarEventEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const screenOptions = useStackScreenOptions();
  // Subscribing to useTranslation ensures the navigator re-renders (and options
  // below re-evaluate) whenever the active language changes.
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Trackers"
        component={TrackersScreen}
        options={{ title: t('settings:menu.trackersTitle') }}
      />
      <Stack.Screen
        name="Ingredients"
        component={IngredientsScreen}
        options={{ title: t('settings:menu.ingredientsTitle') }}
      />
      <Stack.Screen
        name="IngredientEditor"
        component={IngredientEditorScreen}
        getId={({ params }) => params?.foodId ?? 'new'}
        options={({ route }) => ({
          title: route.params?.foodId
            ? t('nutrition:editor.editTitle')
            : t('nutrition:editor.addTitle'),
        })}
      />
      <Stack.Screen
        name="AppSettings"
        component={SettingsNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TrackerHistory"
        component={TrackerHistoryScreen}
        options={{ title: t('trackers:card.history') }}
      />
      <Stack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ title: t('settings:menu.insightsTitle') }}
      />
      <Stack.Screen
        name="Journal"
        component={JournalScreen}
        options={{ title: t('settings:menu.journalTitle') }}
      />
      <Stack.Screen
        name="TodoHistory"
        component={TodoHistoryScreen}
        options={{ title: t('todos:history.title') }}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: t('settings:menu.calendarTitle') }}
      />
      <Stack.Screen
        name="CalendarEventEditor"
        component={CalendarEventEditorScreen}
        getId={({ params }) =>
          params?.eventId ?? `new-${params?.seedDate ?? 'blank'}`
        }
        options={({ route }) => ({
          title: route.params?.eventId
            ? t('calendar:editEvent')
            : t('calendar:newEvent'),
        })}
      />
    </Stack.Navigator>
  );
}
