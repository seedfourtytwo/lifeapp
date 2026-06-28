import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import CountersScreen from './CountersScreen';
import DailyScreen from './DailyScreen';

type HomeTab = 'daily' | 'counters';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<HomeTab>('daily');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <SegmentedButtons
            value={tab}
            onValueChange={(value) => {
              if (value === 'daily' || value === 'counters') {
                setTab(value);
              }
            }}
            buttons={[
              { value: 'daily', label: 'Daily' },
              { value: 'counters', label: 'Counter' },
            ]}
            style={styles.segment}
          />
          <IconButton
            icon="cog-outline"
            size={24}
            iconColor="#FFFFFF"
            onPress={() => navigation.navigate('SettingsMenu')}
            accessibilityLabel="Settings"
            style={styles.gear}
          />
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {tab === 'daily' ? <DailyScreen /> : <CountersScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerSafe: {
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
    paddingBottom: 8,
    gap: 4,
  },
  segment: {
    flex: 1,
  },
  gear: {
    margin: 0,
  },
  content: {
    flex: 1,
  },
});
