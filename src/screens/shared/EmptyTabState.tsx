import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

type Props = {
  message: string;
};

/** Empty Daily/Counter tab with a single CTA into Elements. */
export default function EmptyTabState({ message }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.wrap}>
      <Text variant="bodyLarge" style={styles.message}>
        {message}
      </Text>
      <Button mode="contained-tonal" onPress={() => navigation.navigate('Elements')}>
        Open Elements
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
    opacity: 0.6,
  },
});
