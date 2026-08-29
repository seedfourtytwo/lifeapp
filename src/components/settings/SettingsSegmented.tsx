import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { space } from '../../theme/spacing';

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

/**
 * Past three segments an icon and a label stop fitting side by side on a phone,
 * and Paper truncates the label rather than the icon. The word is the part that
 * says what the option is, so the icon is what goes.
 */
const MAX_SEGMENTS_WITH_ICONS = 3;

export default function SettingsSegmented({ value, onChange, buttons }: Props) {
  const showIcons = buttons.length <= MAX_SEGMENTS_WITH_ICONS;

  return (
    <View style={styles.wrap}>
      <SegmentedButtons
        value={value}
        onValueChange={onChange}
        buttons={buttons.map((button) => ({
          value: button.value,
          label: button.label,
          icon: showIcons ? button.icon : undefined,
          accessibilityLabel: button.label,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
