import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/spacing';
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_BODY_URGENT_REMAINING,
} from './noteBodyLimits';

type Props = {
  /** Characters left, dictation's live take included. */
  remaining: number;
  /** Characters written so far, dictation's live take included. */
  used: number;
  /** "note" or "journal", for the banner sentence. */
  noun: string;
};

/**
 * How close the body is to the cap.
 *
 * Only mounted once the count matters — the sheet decides that — so this has
 * one job: say how much room is left, and turn urgent when it is nearly gone.
 * Colour carries the urgency, never opacity: both states are real text and
 * both have to clear the contrast floor.
 */
export default function NoteEditorLimitNotice({ remaining, used, noun }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  const atLimit = remaining <= 0;
  const urgent = remaining <= NOTE_BODY_URGENT_REMAINING;
  const color = atLimit || urgent ? theme.colors.error : theme.colors.onSurfaceVariant;
  const count = used.toLocaleString();
  const max = NOTE_BODY_MAX_LENGTH.toLocaleString();

  return (
    <View style={styles.block}>
      <Text
        variant="bodySmall"
        accessibilityLiveRegion="polite"
        style={{ color, fontWeight: urgent || atLimit ? '600' : '400' }}
      >
        {atLimit
          ? t('note.limitBannerFull', { noun })
          : urgent
            ? t('note.limitBannerUrgent', { count: remaining })
            : t('note.limitBannerApproaching', { count: remaining })}
      </Text>
      <Text
        variant="labelSmall"
        accessibilityLiveRegion="polite"
        accessibilityLabel={t(
          atLimit
            ? 'note.characterCountLimitReachedA11y'
            : 'note.characterCountApproachingLimitA11y',
          { count, max },
        )}
        style={{
          color,
          fontVariant: ['tabular-nums'],
          marginTop: space.xs,
          textAlign: 'right',
        }}
      >
        {t('note.characterCount', { count, max })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: space.sm,
  },
});
