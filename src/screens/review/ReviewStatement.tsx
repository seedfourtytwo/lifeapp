import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { space } from '../../theme/spacing';
import { fontFamily, typeScale } from '../../theme/typography';
import { emphasisParts, type ReviewCopy } from './reviewCopy';

type Props = {
  /** Null until the first load lands; the sentence keeps its place meanwhile. */
  statement: ReviewCopy | null;
};

/**
 * What Review opens on: one sentence in the display face, straight on the
 * page, with the share done picked out in the accent.
 */
export default function ReviewStatement({ statement }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('review');

  return (
    <Text
      accessibilityRole="header"
      style={[
        typeScale.statement,
        styles.statement,
        statement === null && styles.pending,
        { color: theme.colors.onSurface },
      ]}
    >
      {statement
        ? emphasisParts(t(statement.key, statement.params)).map((part, index) =>
            part.strong ? (
              <Text key={index} style={[styles.figure, { color: theme.colors.primary }]}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )
        : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  statement: {
    paddingHorizontal: space.xxs,
  },
  figure: {
    fontFamily: fontFamily.displayMedium,
  },
  /** Two lines, as the sentence takes on a phone. */
  pending: {
    minHeight: typeScale.statement.lineHeight * 2,
  },
});
