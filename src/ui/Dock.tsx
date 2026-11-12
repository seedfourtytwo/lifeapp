import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IconName } from './Icon';
import { RoundButton } from './RoundButton';
import { space, type NightLight } from './tokens';

export type DockPlace<K extends string> = { key: K; icon: IconName; label: string };

type Props<K extends string> = {
  places: readonly DockPlace<K>[];
  /** The place on screen: its button is lit and said as selected. */
  active: K;
  onSelect: (key: K) => void;
  /** The place's light. Violet: the places are his. */
  light?: NightLight;
  /** The "+" at the end: an action, not a place, so never lit. */
  action?: { icon: IconName; label: string; onPress: () => void };
};

/** The round glass dock at the foot of the three places. */
export function Dock<K extends string>({ places, active, onSelect, light = 'violet', action }: Props<K>) {
  return (
    <View style={dockStyles.dock} accessibilityRole="tablist">
      {places.map((place) => (
        <RoundButton
          key={place.key}
          icon={place.icon}
          accessibilityLabel={place.label}
          light={place.key === active ? light : undefined}
          selected={place.key === active}
          onPress={() => onSelect(place.key)}
        />
      ))}
      {action ? <RoundButton icon={action.icon} accessibilityLabel={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export const dockStyles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
});
