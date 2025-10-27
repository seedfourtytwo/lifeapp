/**
 * AppNavigator
 * Top tab navigation structure
 */

import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Home: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Tab = createMaterialTopTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#B3E5B3',
        tabBarStyle: {
          backgroundColor: '#4CAF50',
          elevation: 4,
          paddingTop: 40, // Space for status bar
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          textTransform: 'none',
        },
        tabBarIndicatorStyle: {
          backgroundColor: '#FFFFFF',
          height: 3,
        },
        tabBarShowIcon: true,
        tabBarIconStyle: {
          width: 24,
          height: 24,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Track',
          tabBarIcon: ({ color }) => <Icon name="play-circle" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <Icon name="chart-bar" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Icon name="cog" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
