import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatShortDate } from '../../utils/dates';
import { APP_DAY_RESET_TIME_LABEL, currentAppCalendarDate } from '../../utils/dayRollover';
import DayHeaderPeeks from './DayHeaderPeeks';
import type { DayHeaderMeta } from './dayHeaderMeta';

type Props = {
  /** Calendar "now" from `useAppCalendarNow` — advances on day rollover. */
  now: Date;
  /**
   * A status line in words, written by the page. A pair sets its second half
   * apart on the right.
   */
  meta?: string | DayHeaderMeta | null;
  /**
   * The page's own line under the date — Today's progress line. It sits where
   * `meta` would and brings its own height.
   */
  children?: React.ReactNode;
  /**
   * Page-specific buttons, aligned with the date — journal notebooks, an add
   * button. The weather chip and the calendar glyph are *not* passed in here:
   * they belong to the header on every page, so `DayHeaderPeeks` renders them
   * before whatever the page adds.
   */
  actions?: React.ReactNode;
};

/**
 * The top of a page that shows a day. One line carries the date in the display
 * face, small enough to leave the page to its rows, with the weather chip, the
 * calendar glyph and the page's own buttons at its end. Under it goes whatever
 * the page says about the day: a `meta` line in words, or its own node.
 */
export default function DayHeader({ now, meta = null, children, actions }: Props) {
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

      {children}
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
