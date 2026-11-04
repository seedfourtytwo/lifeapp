import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { springOrSnap } from '../utils/motion';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** The gap between the well's edge and the thumb. */
const INSET = space.xs;
/** The whole control, well included: the smallest comfortable touch height. */
const MIN_HEIGHT = 44;

/**
 * Pick one of a few options: a quiet well with one raised thumb that slides to
 * the pick. Paper's outlined segmented buttons read as a form; this reads as a
 * switch with more than two positions.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: Props<T>) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    springOrSnap(
      position,
      { toValue: index, useNativeDriver: true, speed: 20, bounciness: 0 },
      reduceMotion,
    ).start();
  }, [index, position, reduceMotion]);

  const segmentWidth = options.length > 0 ? (trackWidth - INSET * 2) / options.length : 0;

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={onLayout}
      style={[
        styles.track,
        { backgroundColor: theme.colors.surfaceVariant, borderRadius: deco.radius.md },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              backgroundColor: theme.colors.surface,
              // Concentric with the well: its corner minus the inset.
              borderRadius: deco.radius.md - INSET,
              shadowColor: theme.colors.shadow,
              transform: [{ translateX: Animated.multiply(position, segmentWidth) }],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: selected ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                  fontWeight: selected ? '600' : '400',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    minHeight: MIN_HEIGHT,
    padding: INSET,
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  label: {
    ...typeScale.secondary,
  },
});
