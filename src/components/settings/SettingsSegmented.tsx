import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../theme/spacing';
import SegmentedControl from '../SegmentedControl';

export type SettingsSegmentedButton = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  buttons: SettingsSegmentedButton[];
};

/** A segmented control set inside a settings group, padded to the rows' edges. */
export default function SettingsSegmented({ value, onChange, buttons }: Props) {
  return (
    <View style={styles.wrap}>
      <SegmentedControl options={buttons} value={value} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
