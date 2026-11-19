import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import QuietText from '../../components/QuietText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../navigation/types';
import { space } from '../../theme/spacing';

type Props = {
  message: string;
};

/** Today with no habit or counter on it: one sentence and one way into Trackers. */
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
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  message: {
    textAlign: 'center',
  },
});
