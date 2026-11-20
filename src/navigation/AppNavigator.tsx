import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from './types';
import { useStackScreenOptions } from './useStackScreenOptions';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ReviewRoute from '../screens/ReviewRoute';
import TrackersScreen from '../screens/TrackersScreen';
import IngredientsScreen from '../screens/IngredientsScreen';
import IngredientEditorScreen from '../screens/IngredientEditorScreen';
import NutritionRoute from '../screens/NutritionRoute';
import WeatherLocationScreen from '../screens/settings/WeatherLocationScreen';
import TrackerHistoryScreen from '../screens/TrackerHistoryScreen';
import TodoHistoryScreen from '../screens/TodoHistoryScreen';
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
        name="Calendar"
        component={CalendarScreen}
        options={{ title: t('settings:menu.calendarTitle') }}
      />
      <Stack.Screen
        name="Review"
        component={ReviewRoute}
        options={{ title: t('settings:menu.reviewTitle') }}
      />
      <Stack.Screen
        name="Trackers"
        component={TrackersScreen}
        options={{ title: t('settings:menu.trackersTitle') }}
      />
      <Stack.Screen
        name="Nutrition"
        component={NutritionRoute}
        options={{ title: t('settings:menu.foodTitle') }}
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
        name="WeatherLocation"
        component={WeatherLocationScreen}
        options={{ title: t('settings:weather.locationTitle') }}
      />
      <Stack.Screen
        name="TrackerHistory"
        component={TrackerHistoryScreen}
        options={{ title: t('trackers:card.history') }}
      />
      <Stack.Screen
        name="TodoHistory"
        component={TodoHistoryScreen}
        options={{ title: t('todos:history.title') }}
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
