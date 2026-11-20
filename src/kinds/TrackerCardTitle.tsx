import React from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import QuietText from '../components/QuietText';
import type { TrackerIconId } from '../protocol';
import type { KindColour } from '../theme/palette';
import { typeScale } from '../theme/typography';
import type { TrackerCardCaption } from './habit/habitCardLabels';
import { useTilePress } from './TrackerCard';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerIdentityMark } from './TrackerIdentityMark';
import type { TrackerCardTitleInteractionProps } from './trackerCardTitleInteractions';

type Props = TrackerCardTitleInteractionProps & {
  name: string;
  /** Whose colour the row's tile wears. */
  kind: KindColour;
  /** The tracker's own icon, drawn on the tile in place of the kind's glyph. */
  icon?: TrackerIconId | null;
  /**
   * The line under the name when it is more than a plain run — "Skipped today",
   * "Strength 62" (figure in the mono face).
   */
  caption?: TrackerCardCaption | null;
};

/**
 * Home row title: the kind's tile, the name, and the run under it in a quiet
 * caption. One tap opens history; a hold reorders.
 */
export function TrackerCardTitle({
  name,
  kind,
  icon = null,
  caption: line = null,
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
      <TrackerIdentityMark kind={kind} icon={icon} />
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
