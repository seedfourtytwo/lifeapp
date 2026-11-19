import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

const SIZE = 26;

type Props = {
  checked: boolean;
  /** Red rather than moss: ticking this row destroys something. */
  danger?: boolean;
};

/**
 * The tick on a pick-many row in a sheet: the habit tick's empty ring and
 * filled disc at a smaller size. It only draws — the row around it is the
 * button, and announces the checked state.
 */
export default function SheetCheck({ checked, danger = false }: Props) {
  const theme = useTheme();
  const fill = danger ? theme.colors.error : theme.colors.primary;
  const mark = danger ? theme.colors.onError : theme.colors.onPrimary;
  return (
    <View
      testID="sheet-check"
      style={[
        styles.ring,
        checked
          ? { backgroundColor: fill, borderColor: fill }
          : { borderColor: theme.colors.outlineVariant },
      ]}
    >
      {checked ? <MaterialCommunityIcons name="check" size={16} color={mark} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    // Geometry: a circle.
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
