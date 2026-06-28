import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

export default function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <List.Section>
        <List.Item
          title="Elements"
          description="Manage habits and counters"
          left={(props) => <List.Icon {...props} icon="shape-plus" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('Elements')}
        />
        <List.Item
          title="App settings"
          description="About and preferences"
          left={(props) => <List.Icon {...props} icon="tune" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => navigation.navigate('AppSettings')}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    flexGrow: 1,
  },
});
