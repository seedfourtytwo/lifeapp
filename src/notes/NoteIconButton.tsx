import React from 'react';
import { IconButton, useTheme } from 'react-native-paper';

type Props = {
  hasNote: boolean;
  /** Tap: open and start dictation. */
  onPress: () => void;
  /** Long-press: open for edit without auto-dictation. */
  onLongPress?: () => void;
  /** Accessibility noun, e.g. "note" or "journal". */
  accessibilityNoun?: string;
  size?: number;
  style?: object;
};

/**
 * Home note affordance — tap mic to dictate; long-press to edit.
 * Primary color when a note already exists for today.
 */
export function NoteIconButton({
  hasNote,
  onPress,
  onLongPress,
  accessibilityNoun = 'note',
  size = 18,
  style,
}: Props) {
  const theme = useTheme();
  return (
    <IconButton
      icon="microphone-outline"
      size={size}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      iconColor={hasNote ? theme.colors.primary : theme.colors.onSurfaceVariant}
      accessibilityLabel={
        hasNote ? `Dictate ${accessibilityNoun}` : `Dictate new ${accessibilityNoun}`
      }
      accessibilityHint={
        onLongPress ? 'Long press to open and edit without dictating' : undefined
      }
      style={[{ margin: 0 }, style]}
      hitSlop={8}
    />
  );
}
