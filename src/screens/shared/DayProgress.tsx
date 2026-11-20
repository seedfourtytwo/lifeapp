import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { dayProgress } from './dayProgress';

/** A segment's height; half of it rounds the ends into a capsule. */
const BAR_HEIGHT = 6;

/**
 * The bar is thin; the line around it is what a thumb finds. The line stays
 * close under the date and takes the rest of its 48 from the header's own
 * margin below, where nothing else is listening.
 */
const LINE_MIN_HEIGHT = 32;
const LINE_HIT_SLOP = { bottom: space.lg };

type Props = {
  /** `buildTodayModel`'s figures — the ones the widget shows. */
  done: number;
  due: number;
  /** The whole line is the way into Review. */
  onPress: () => void;
};

/**
 * How today stands, as one line under the date: a segment per item due, the
 * done ones in moss, then the tally in the mono face. Past
 * `MAX_PROGRESS_SEGMENTS` it is one bar filled by share. With nothing due
 * there is no line. Tapping it opens Review.
 */
export default function DayProgress({ done, due, onPress }: Props) {
  const theme = useTheme();
  const { palette } = useAppTheme();
  const { t } = useTranslation('home');
  const progress = dayProgress(done, due);
  if (!progress) return null;

  const filled = { backgroundColor: theme.colors.primary };
  const open = { backgroundColor: palette.track };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={LINE_HIT_SLOP}
      style={styles.line}
      accessibilityRole="button"
      accessibilityLabel={t('dayHeader.todayDone', { done: progress.done, total: progress.due })}
      accessibilityHint={t('dayHeader.openReviewHint')}
    >
      {progress.shape === 'segments' ? (
        <View style={styles.segments}>
          {Array.from({ length: progress.due }, (_, index) => (
            <View key={index} style={[styles.piece, index < progress.done ? filled : open]} />
          ))}
        </View>
      ) : (
        <View style={[styles.bar, open]}>
          <View style={[styles.barFill, filled, { flex: progress.done }]} />
          <View style={{ flex: progress.due - progress.done }} />
        </View>
      )}
      <Text style={[styles.tally, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
        <Text style={{ color: theme.colors.onSurface }}>{progress.done}</Text>
        {` / ${progress.due}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: LINE_MIN_HEIGHT,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: space.xs,
  },
  piece: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: BAR_HEIGHT / 2,
  },
  tally: {
    ...typeScale.data,
    fontSize: 15,
    lineHeight: 20,
  },
});
