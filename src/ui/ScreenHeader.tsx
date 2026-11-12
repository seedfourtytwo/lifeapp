import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NightText } from './NightText';
import { RoundButton } from './RoundButton';
import { space, TOUCH_MIN } from './tokens';

type Props = {
  title: string;
  /** A pushed screen goes back; one of the three places has none, and shows its title larger. */
  back?: { label: string; onPress: () => void };
  /** On the right: "Edit", a gear, a menu. */
  actions?: React.ReactNode;
};

/** The top of a screen: back, the title, its few actions. */
export function ScreenHeader({ title, back, actions }: Props) {
  return (
    <View style={screenHeaderStyles.header}>
      {back ? <RoundButton icon="chevron-left" size="sm" accessibilityLabel={back.label} onPress={back.onPress} /> : null}
      <NightText kind={back ? 'title' : 'place'} accessibilityRole="header" style={screenHeaderStyles.title}>
        {title}
      </NightText>
      {actions ? <View style={screenHeaderStyles.actions}>{actions}</View> : null}
    </View>
  );
}

export const screenHeaderStyles = StyleSheet.create({
  header: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  title: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
