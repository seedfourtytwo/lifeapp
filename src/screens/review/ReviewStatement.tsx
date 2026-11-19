import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../../components/QuietText';
import { space } from '../../theme/spacing';
import { fontFamily, typeScale } from '../../theme/typography';
import { emphasisParts, type ReviewCopy } from './reviewCopy';
import { REVIEW_MAX_MEASURE } from './reviewGeometry';

type Props = {
  /** Null until the first load lands; the block keeps its place meanwhile. */
  statement: ReviewCopy | null;
  footnote: readonly ReviewCopy[];
  /** Shared with the grid, so both cross-fade together when the range changes. */
  fade: Animated.Value;
};

/**
 * What Review opens on: one sentence in the display face, straight on the
 * page, with its figures a weight heavier — then a quiet line saying what
 * slipped and what was not counted.
 */
export default function ReviewStatement({ statement, footnote, fade }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('review');
  const pending = statement === null;

  return (
    <Animated.View style={[styles.block, { opacity: fade }]}>
      <Text
        accessibilityRole="header"
        style={[typeScale.statement, pending && styles.statementPending, { color: theme.colors.onSurface }]}
      >
        {statement
          ? emphasisParts(t(statement.key, statement.params)).map((part, index) =>
              part.strong ? (
                <Text key={index} style={styles.figure}>
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )
          : null}
      </Text>
      <QuietText style={[typeScale.secondary, pending && styles.footnotePending]}>
        {footnote.map((line) => t(line.key, line.params)).join(' ')}
      </QuietText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    maxWidth: REVIEW_MAX_MEASURE,
    gap: space.md,
    paddingHorizontal: space.xxs,
  },
  figure: {
    fontFamily: fontFamily.displayMedium,
  },
  /** Three lines of the statement and two of the footnote, as on a phone. */
  statementPending: {
    minHeight: typeScale.statement.lineHeight * 3,
  },
  footnotePending: {
    minHeight: typeScale.secondary.lineHeight * 2,
  },
});
