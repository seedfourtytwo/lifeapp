import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import QuietText from '../../components/QuietText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  message: string;
};

/** Empty Habits/Counters tab with a single CTA into Trackers. */
export default function EmptyTabState({ message }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation('home');

  return (
    <View style={styles.wrap}>
      <QuietText variant="bodyLarge" style={styles.message}>
        {message}
      </QuietText>
      <Button mode="contained-tonal" onPress={() => navigation.navigate('Trackers')}>
        {t('emptyTabState.openTrackers')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
    gap: 16,
  },
  message: {
    textAlign: 'center',
  },
});
