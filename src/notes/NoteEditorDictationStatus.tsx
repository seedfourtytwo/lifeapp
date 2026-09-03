import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { space } from '../theme/spacing';

type Props = {
  /** True when the app language has no on-device model of its own. */
  englishOnly: boolean;
  /** Model download / warm-up progress, when there is any. */
  status: { message: string; progress?: number | null } | null;
  /** A dictation failure, already localized. */
  error: string | null;
};

/**
 * What the mic has to say for itself before you start writing: that this
 * language dictates in English, that a model is still downloading, that the
 * last attempt failed.
 *
 * The softer after-the-fact notice ("nothing heard", "budget reached") stays
 * with the sheet: it belongs under the body, next to the character count,
 * not above it.
 */
export default function NoteEditorDictationStatus({
  englishOnly,
  status,
  error,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');

  return (
    <>
      {englishOnly ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: space.xs }}
        >
          {t('dictation.englishOnlyHint')}
        </Text>
      ) : null}

      {status ? (
        <View style={styles.statusBlock}>
          <Text
            variant="bodySmall"
            accessibilityLiveRegion="polite"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {status.message}
          </Text>
          {status.progress != null ? (
            <ProgressBar
              progress={status.progress / 100}
              style={styles.progress}
              accessibilityLabel={status.message}
            />
          ) : null}
        </View>
      ) : null}

      {error ? (
        <Text
          variant="bodySmall"
          accessibilityLiveRegion="polite"
          style={{ color: theme.colors.error, marginBottom: space.xs }}
        >
          {error}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  statusBlock: {
    marginBottom: space.sm,
    gap: 6,
  },
  progress: {
    height: 4,
    borderRadius: 2,
  },
});
