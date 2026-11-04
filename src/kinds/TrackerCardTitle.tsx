import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerIdentityMark } from './TrackerIdentityMark';
import { StreakFireCount } from './StreakFireCount';
import type { TrackerCardTitleInteractionProps } from './trackerCardTitleInteractions';

type Props = TrackerCardTitleInteractionProps & {
  name: string;
  /** Optional curated tracker icon, shown as the mark before the name. */
  icon?: TrackerIconId | null;
  /** 0–1 progress for the identity ring (timers/counters); boolean done → 1. */
  progress?: number | null;
  /** Prefer complete styling on the mark (filled well / primary ring). */
  complete?: boolean;
  /** Compact streak day count (badge on icon mark, inline after text). */
  streakDays?: number | null;
  /** Full streak phrase for screen readers. */
  streakAccessibilityLabel?: string | null;
};

/**
 * Home card title: the mark (when there is an icon) and the name, always both —
 * an icon alone is not guessable. One tap opens history; a hold reorders.
 */
export function TrackerCardTitle({
  name,
  icon = null,
  progress = null,
  complete = false,
  streakDays = null,
  streakAccessibilityLabel = null,
  onOpenDetails,
  onLongPressReorder,
  onReorderTouchMove,
  onReorderTouchEnd,
  onReorderTouchCancel,
  delayLongPressReorder = 380,
  reorderHint,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('trackers');
  const showStreak = streakDays != null && streakDays > 0;
  const label =
    showStreak && streakAccessibilityLabel ? `${name}, ${streakAccessibilityLabel}` : name;
  const interactive = Boolean(onOpenDetails || onLongPressReorder);
  const a11yHint = [
    onOpenDetails ? t('homeIdentity.historyHint') : null,
    onLongPressReorder ? reorderHint : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={onOpenDetails}
      onLongPress={onLongPressReorder}
      delayLongPress={delayLongPressReorder}
      onTouchMove={onLongPressReorder ? onReorderTouchMove : undefined}
      onTouchEnd={onLongPressReorder ? onReorderTouchEnd : undefined}
      onTouchCancel={onLongPressReorder ? onReorderTouchCancel : undefined}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.titlePress,
        styles.titleInline,
        pressed && interactive && styles.pressed,
      ]}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={a11yHint || undefined}
    >
      {icon ? (
        <TrackerIdentityMark
          icon={icon}
          progress={progress}
          complete={complete}
          streakDays={streakDays}
        />
      ) : null}
      <View style={styles.nameWrap}>
        <Text
          variant="bodyLarge"
          numberOfLines={1}
          style={[styles.name, { color: theme.colors.onSurface }]}
        >
          {name}
        </Text>
        {!icon && showStreak ? (
          <StreakFireCount days={streakDays} color={theme.colors.primary} variant="inline" />
        ) : null}
      </View>
    </Pressable>
  );
}
