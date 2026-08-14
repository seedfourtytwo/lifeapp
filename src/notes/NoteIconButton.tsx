import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { TrackerIcon } from '../components/trackerIcons/TrackerIcon';
import { StickyNoteMicIcon } from './StickyNoteMicIcon';

type Props = {
  hasNote: boolean;
  /** Tap: open and start dictation. */
  onPress: () => void;
  /** Long-press: open for edit without auto-dictation. */
  onLongPress?: () => void;
  /** Accessibility noun, e.g. "note" or notebook name. */
  accessibilityNoun?: string;
  size?: number;
  style?: object;
  /** Notebook identity color — always full strength. */
  accentColor?: string;
  /** Optional tracker-library icon; default is the sticky-note+mic glyph. */
  icon?: TrackerIconId;
};

/**
 * Home note affordance — sticky note + mic, or a tinted catalog icon.
 * Tap to dictate; long-press to edit. A discrete aura marks “has text today”.
 */
export function NoteIconButton({
  hasNote,
  onPress,
  onLongPress,
  accessibilityNoun,
  size = 22,
  style,
  accentColor,
  icon,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const noun = accessibilityNoun ?? t('note.noteNoun');
  const idle = theme.colors.onSurfaceVariant;
  const glyphColor = accentColor ?? (hasNote ? theme.colors.primary : idle);
  const auraColor = accentColor ?? theme.colors.primary;
  const box = size + 16;
  const auraBox = size + 10;

  return (
    <View style={[styles.wrap, { width: box, height: box }, style]}>
      {hasNote ? (
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            {
              width: auraBox,
              height: auraBox,
              borderRadius: auraBox / 2,
              backgroundColor: auraColor,
              marginLeft: -auraBox / 2,
              marginTop: -auraBox / 2,
            },
          ]}
        />
      ) : null}
      <IconButton
        icon={({ size: iconSize }) =>
          icon ? (
            <TrackerIcon name={icon} size={iconSize} color={glyphColor} />
          ) : (
            <StickyNoteMicIcon size={iconSize} color={glyphColor} />
          )
        }
        size={size}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityLabel={
          hasNote
            ? t('note.dictateAccessible', { noun })
            : t('note.dictateNewAccessible', { noun })
        }
        accessibilityHint={onLongPress ? t('note.dictateHint') : undefined}
        style={styles.button}
        hitSlop={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    opacity: 0.18,
  },
  button: {
    margin: 0,
  },
});
