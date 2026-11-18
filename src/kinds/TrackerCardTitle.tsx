import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import type { TrackerIconId } from '../protocol';
import { typeScale } from '../theme/typography';
import type { TrackerCardCaption } from './habit/habitCardLabels';
import { useTilePress } from './TrackerCard';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerIdentityMark } from './TrackerIdentityMark';
import type { TrackerCardTitleInteractionProps } from './trackerCardTitleInteractions';

type Props = TrackerCardTitleInteractionProps & {
  name: string;
  /** Optional curated tracker icon, shown as the disc before the name. */
  icon?: TrackerIconId | null;
  /** 0–1 of today's target (timers/counters), shown round the disc. */
  progress?: number | null;
  /** Done: the disc fills moss. */
  complete?: boolean;
  /** "4 days in a row", under the name; null shows nothing. */
  streakLabel?: string | null;
  /**
   * The line under the name when it is more than a plain run — "Skipped today",
   * "Strength 62" (figure in the mono face). Wins over `streakLabel`.
   */
  caption?: TrackerCardCaption | null;
};

/**
 * Home row title: the disc (when there is an icon), the name, and the run under
 * it in a quiet caption. One tap opens history; a hold reorders.
 */
export function TrackerCardTitle({
  name,
  icon = null,
  progress = null,
  complete = false,
  streakLabel = null,
  caption = null,
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
  const pressTile = useTilePress();
  const interactive = Boolean(onOpenDetails || onLongPressReorder);
  const line: TrackerCardCaption | null =
    caption ?? (streakLabel ? { text: streakLabel, a11y: streakLabel } : null);
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
      onPressIn={interactive ? () => pressTile(true) : undefined}
      onPressOut={interactive ? () => pressTile(false) : undefined}
      delayLongPress={delayLongPressReorder}
      onTouchMove={onLongPressReorder ? onReorderTouchMove : undefined}
      onTouchEnd={onLongPressReorder ? onReorderTouchEnd : undefined}
      onTouchCancel={onLongPressReorder ? onReorderTouchCancel : undefined}
      disabled={!interactive}
      style={[styles.titlePress, styles.titleInline]}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={line ? `${name}, ${line.a11y}` : name}
      accessibilityHint={a11yHint || undefined}
    >
      {icon ? <TrackerIdentityMark icon={icon} progress={progress} complete={complete} /> : null}
      <View style={styles.nameWrap}>
        <Text numberOfLines={1} style={[styles.name, { color: theme.colors.onSurface }]}>
          {name}
        </Text>
        {line ? (
          <QuietText numberOfLines={1} style={styles.caption}>
            {line.text}
            {line.figure ? (
              <Text style={[typeScale.data, { color: theme.colors.onSurfaceVariant }]}>
                {` ${line.figure}`}
              </Text>
            ) : null}
          </QuietText>
        ) : null}
      </View>
    </Pressable>
  );
}
