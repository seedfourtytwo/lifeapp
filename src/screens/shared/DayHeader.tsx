import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatShortDate } from '../../utils/dates';
import { APP_DAY_RESET_TIME_LABEL, currentAppCalendarDate } from '../../utils/dayRollover';
import ActivityStrip, { type ActivityDay } from './ActivityStrip';
import DayHeaderPeeks from './DayHeaderPeeks';
import type { DayHeaderMeta } from './dayHeaderMeta';

type Props = {
  /** Calendar "now" from `useAppCalendarNow` — advances on day rollover. */
  now: Date;
  /**
   * What today looks like so far, written by the tab — "3 of 5 done" means
   * something different on Habits than on Todos. A pair sets the run apart on
   * the right: "2 of 6 done" … "13 days in a row".
   */
  meta?: string | DayHeaderMeta | null;
  /** Recent days for the strip; empty hides it. */
  activity?: ActivityDay[];
  activityLabel?: string;
  /**
   * Tab-specific buttons, aligned with the date — journal notebooks, a history
   * shortcut. The weather chip and the calendar glyph are *not* passed in here:
   * they belong to the header on every tab, so `DayHeaderPeeks` renders them
   * before whatever the tab adds.
   */
  actions?: React.ReactNode;
};

/**
 * The top of a Home tab: which day this is, how it is going, and how the last
 * fortnight went.
 *
 * This inverts what was here before. The date was `bodyMedium` at 85% opacity
 * next to a 15pt refresh glyph — the quietest thing on a screen whose whole
 * premise is *which day is this and what have I done today*, while the tracker
 * rows shouted. Now the day is set in the display face at 28pt and the rest of
 * the screen stays deliberately flat underneath it.
 */
export default function DayHeader({
  now,
  meta = null,
  activity = [],
  activityLabel,
  actions,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation('home');
  const date = formatShortDate(currentAppCalendarDate(now));
  const status = typeof meta === 'string' ? { lead: meta, trail: null } : meta;
  const metaStyle = [typeScale.secondary, { color: theme.colors.onSurfaceVariant }];

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text
          style={[typeScale.dayTitle, styles.title, { color: theme.colors.onSurface }]}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={t('dayStatus.a11y', {
            date,
            time: APP_DAY_RESET_TIME_LABEL,
          })}
        >
          {date}
        </Text>
        <View style={styles.actions}>
          <DayHeaderPeeks now={now} />
          {actions}
        </View>
      </View>

      {status ? (
        <View style={styles.metaRow}>
          <Text style={[metaStyle, styles.metaLead]} numberOfLines={1}>
            {status.lead}
          </Text>
          {status.trail ? (
            <Text style={metaStyle} numberOfLines={1}>
              {status.trail}
            </Text>
          ) : null}
        </View>
      ) : null}

      {activity.length > 0 && activityLabel ? (
        <ActivityStrip days={activity} accessibilityLabel={activityLabel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: space.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.xs,
  },
  metaLead: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: 40,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
