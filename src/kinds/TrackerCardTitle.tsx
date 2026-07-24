import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { TrackerIconId } from '../protocol';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerIdentityMark } from './TrackerIdentityMark';
import { StreakFireCount } from './StreakFireCount';
import type { TrackerCardTitleInteractionProps } from './trackerCardTitleInteractions';

type Props = TrackerCardTitleInteractionProps & {
  name: string;
  /** Optional curated tracker icon — when set, Home shows the identity mark only. */
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
 * Home leading identity:
 * - With icon → mark only; name fades in on reorder long-press, then out on release
 * - Without icon → text name + inline streak (classic fallback)
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
  const suppressNextPress = useRef(false);
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameHintActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const [nameRevealed, setNameRevealed] = useState(false);
  const showStreak = streakDays != null && streakDays > 0;
  const label =
    showStreak && streakAccessibilityLabel
      ? `${name}, ${streakAccessibilityLabel}`
      : name;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      nameOpacity.stopAnimation();
    };
  }, [nameOpacity]);

  const revealNameForReorder = () => {
    if (!icon) return;
    nameHintActiveRef.current = true;
    setNameRevealed(true);
    nameOpacity.stopAnimation();
    nameOpacity.setValue(0);
    Animated.timing(nameOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const hideNameAfterReorder = () => {
    if (!icon || !nameHintActiveRef.current) return;
    nameHintActiveRef.current = false;
    nameOpacity.stopAnimation();
    Animated.timing(nameOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && mountedRef.current) setNameRevealed(false);
    });
  };

  const finishReorderGesture = (event: GestureResponderEvent, end: boolean) => {
    if (end) {
      onReorderTouchEnd?.(event);
    } else {
      onReorderTouchCancel?.(event);
    }
    hideNameAfterReorder();
    requestAnimationFrame(() => {
      suppressNextPress.current = false;
    });
  };

  return (
    <Pressable
      onPress={() => {
        if (suppressNextPress.current) {
          suppressNextPress.current = false;
          return;
        }
        onOpenDetails?.();
      }}
      onLongPress={
        onLongPressReorder
          ? (event) => {
              suppressNextPress.current = true;
              revealNameForReorder();
              onLongPressReorder(event);
            }
          : undefined
      }
      delayLongPress={delayLongPressReorder}
      onTouchMove={onLongPressReorder ? onReorderTouchMove : undefined}
      onTouchEnd={
        onLongPressReorder
          ? (event) => finishReorderGesture(event, true)
          : undefined
      }
      onTouchCancel={
        onLongPressReorder
          ? (event) => finishReorderGesture(event, false)
          : undefined
      }
      disabled={!onOpenDetails && !onLongPressReorder}
      style={({ pressed }) => [
        styles.titlePress,
        styles.titleInline,
        pressed && (onOpenDetails || onLongPressReorder) && styles.pressed,
      ]}
      accessibilityRole={onOpenDetails || onLongPressReorder ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityHint={onLongPressReorder ? reorderHint : undefined}
    >
      {icon ? (
        <>
          <TrackerIdentityMark
            icon={icon}
            progress={progress}
            complete={complete}
            streakDays={streakDays}
          />
          {nameRevealed ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.reorderNameWrap,
                {
                  opacity: nameOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.62],
                  }),
                  transform: [
                    {
                      translateX: nameOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text
                variant="titleSmall"
                numberOfLines={1}
                style={[styles.reorderName, { color: theme.colors.onSurface }]}
              >
                {name}
              </Text>
            </Animated.View>
          ) : null}
        </>
      ) : (
        <>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={[styles.name, { color: theme.colors.onSurface }]}
          >
            {name}
          </Text>
          {typeof streakDays === 'number' && streakDays > 0 ? (
            <StreakFireCount
              days={streakDays}
              color={theme.colors.primary}
              variant="inline"
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
