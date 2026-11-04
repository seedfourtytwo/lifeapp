import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, IconButton, useTheme } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';

export type EditorSheetPrimaryAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export type EditorSheetDestructiveAction = {
  /** Read out for the icon; the button itself has no words. */
  accessibilityLabel: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
};

type Props = {
  primaryAction?: EditorSheetPrimaryAction;
  destructiveAction?: EditorSheetDestructiveAction;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const SAVE_MIN_WIDTH = 132;
const SAVE_MIN_HEIGHT = 52;

/**
 * The editor footer: a red icon on the left for the destructive action, a moss
 * Save pill on the right you can hit without looking. Shared by the editor
 * sheet and the event editor screen so both read as one pattern.
 */
export default function SheetFooter({ primaryAction, destructiveAction, testID, style }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  return (
    <View testID={testID} style={[styles.footer, style]}>
      {destructiveAction ? (
        <IconButton
          icon={destructiveAction.icon ?? 'trash-can-outline'}
          iconColor={theme.colors.error}
          size={24}
          onPress={destructiveAction.onPress}
          disabled={destructiveAction.disabled}
          accessibilityLabel={destructiveAction.accessibilityLabel}
          style={styles.destructive}
        />
      ) : (
        <View />
      )}
      {primaryAction ? (
        <Button
          mode="contained"
          onPress={primaryAction.onPress}
          disabled={primaryAction.disabled}
          loading={primaryAction.loading}
          style={[styles.save, { borderRadius: deco.radius.pill }]}
          contentStyle={styles.saveContent}
          labelStyle={styles.saveLabel}
        >
          {primaryAction.label}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  destructive: {
    margin: 0,
    marginLeft: -space.sm,
  },
  save: {
    minWidth: SAVE_MIN_WIDTH,
  },
  saveContent: {
    minHeight: SAVE_MIN_HEIGHT,
    paddingHorizontal: space.md,
  },
  saveLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
});
