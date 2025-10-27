/**
 * AppNavigator
 * Bottom tab navigation structure
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          elevation: 8,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#4CAF50',
          elevation: 4,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Life Tracker',
          tabBarLabel: 'Track',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'Statistics',
          tabBarLabel: 'Stats',
          tabBarIcon: ({ color, size }) => <Icon name="chart-bar" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Icon name="cog" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
