import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import SettingsGroup from '../../components/settings/SettingsGroup';
import SettingsRow from '../../components/settings/SettingsRow';
import type { RootStackParamList } from '../../navigation/types';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { HomeTabScrollView } from '../shared/HomeTabScrollView';
import { homeTabScreenStyles } from '../shared/screenStyles';

/**
 * The More page: everything Home does not show every day. It is the fifth page
 * of the Home pager, not a pushed screen, so it carries its own title where the
 * other pages carry the date — same display face, same place on the page — and
 * scrolls through `HomeTabScrollView` like they do, which leaves the pager's
 * horizontal gesture alone.
 *
 * Mount cost matters here for the same reason it does on every Home page: all
 * five mount at startup. This one reads no store and touches no database — it
 * is a fixed list of rows whose destinations do their own loading when pushed.
 * Keep it that way.
 */
function SettingsMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { t } = useTranslation('settings');

  return (
    <HomeTabScrollView contentContainerStyle={[homeTabScreenStyles.container, styles.container]}>
      <View style={styles.header}>
        <Text
          style={[typeScale.screenTitle, { color: theme.colors.onSurface }]}
          accessibilityRole="header"
        >
          {t('home:dock.more')}
        </Text>
      </View>

      <SettingsGroup>
        <SettingsRow
          icon="chart-timeline-variant"
          title={t('menu.insightsTitle')}
          chevron
          onPress={() => navigation.navigate('Insights')}
        />
        <SettingsRow
          icon="notebook-outline"
          title={t('menu.journalTitle')}
          chevron
          onPress={() => navigation.navigate('Journal')}
        />
        <SettingsRow
          icon="calendar-month"
          title={t('menu.calendarTitle')}
          chevron
          onPress={() => navigation.navigate('Calendar')}
        />
        <SettingsRow
          icon="checkbox-multiple-marked-outline"
          title={t('menu.trackersTitle')}
          chevron
          onPress={() => navigation.navigate('Trackers')}
        />
        <SettingsRow
          icon="food-apple-outline"
          title={t('menu.ingredientsTitle')}
          chevron
          onPress={() => navigation.navigate('Ingredients')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="cog-outline"
          title={t('menu.settingsTitle')}
          chevron
          onPress={() => navigation.navigate('AppSettings')}
        />
      </SettingsGroup>
    </HomeTabScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    paddingBottom: space.xl,
  },
  /** Matches the day header's title row on the other Home pages. */
  header: {
    justifyContent: 'center',
    minHeight: 40,
  },
});

/**
 * Memoised because it takes no props: a Home tab change re-renders HomeScreen,
 * and this page has no reason to follow it.
 */
export default memo(SettingsMenuScreen);
