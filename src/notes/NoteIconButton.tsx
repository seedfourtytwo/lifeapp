import React from 'react';
import { IconButton, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

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
  accessibilityNoun,
  size = 18,
  style,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const noun = accessibilityNoun ?? t('note.noteNoun');
  return (
    <IconButton
      icon="microphone-outline"
      size={size}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      iconColor={hasNote ? theme.colors.primary : theme.colors.onSurfaceVariant}
      accessibilityLabel={
        hasNote
          ? t('note.dictateAccessible', { noun })
          : t('note.dictateNewAccessible', { noun })
      }
      accessibilityHint={onLongPress ? t('note.dictateHint') : undefined}
      style={[{ margin: 0 }, style]}
      hitSlop={8}
    />
  );
}
