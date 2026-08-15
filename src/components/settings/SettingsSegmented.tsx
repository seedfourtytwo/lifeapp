import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

export type SettingsSegmentedButton = {
  value: string;
  label: string;
  icon?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  buttons: SettingsSegmentedButton[];
};

export default function SettingsSegmented({ value, onChange, buttons }: Props) {
  return (
    <View style={styles.wrap}>
      <SegmentedButtons
        value={value}
        onValueChange={onChange}
        buttons={buttons.map((button) => ({
          value: button.value,
          label: button.label,
          icon: button.icon,
          accessibilityLabel: button.label,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
