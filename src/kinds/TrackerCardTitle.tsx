import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TrackerIconId } from '../protocol';
import { trackerCardStyles as styles } from './trackerCardStyles';
import { TrackerIdentityMark } from './TrackerIdentityMark';
import { StreakFireCount } from './StreakFireCount';
import type { TrackerCardTitleInteractionProps } from './trackerCardTitleInteractions';

/** Hold this long to whisper the name (icon-only rows). */
const NAME_PEEK_MS = 300;
/** Extra hold after press-start before reorder arms. */
const REORDER_EXTRA_MS = 480;
/** Two taps within this window open history / details. */
const DOUBLE_TAP_MS = 320;

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
 * Home card title / identity.
 * With icon: mark only; short hold peeks the name; longer hold starts reorder.
 * Without icon: text title; long-press reorders. Double-tap opens history.
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
  /** Epoch of the active press; peek/reorder suppress only that press's onPress. */
  const pressEpochRef = useRef(0);
  const suppressPressEpochRef = useRef<number | null>(null);
  const lastTapAtRef = useRef(0);
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameHintActiveRef = useRef(false);
  const namePeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [nameRevealed, setNameRevealed] = useState(false);
  const showStreak = streakDays != null && streakDays > 0;
  const label =
    showStreak && streakAccessibilityLabel
      ? `${name}, ${streakAccessibilityLabel}`
      : name;

  const stagedHold = Boolean(icon && onLongPressReorder);
  const reorderDelayMs = stagedHold
    ? Math.max(delayLongPressReorder + REORDER_EXTRA_MS, NAME_PEEK_MS + REORDER_EXTRA_MS)
    : delayLongPressReorder;

  const a11yHint = [
    onOpenDetails ? t('homeIdentity.doubleTapHistoryHint') : null,
    onLongPressReorder ? reorderHint : null,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      nameOpacity.stopAnimation();
      if (namePeekTimerRef.current) {
        clearTimeout(namePeekTimerRef.current);
        namePeekTimerRef.current = null;
      }
    };
  }, [nameOpacity]);

  const clearNamePeekTimer = () => {
    if (namePeekTimerRef.current) {
      clearTimeout(namePeekTimerRef.current);
      namePeekTimerRef.current = null;
    }
  };

  const suppressThisPress = () => {
    suppressPressEpochRef.current = pressEpochRef.current;
    lastTapAtRef.current = 0;
  };

  const revealName = () => {
    if (!icon) return;
    nameHintActiveRef.current = true;
    // Name peek must not open history / count toward double-tap on release.
    suppressThisPress();
    setNameRevealed(true);
    nameOpacity.stopAnimation();
    nameOpacity.setValue(0);
    Animated.timing(nameOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const hideName = () => {
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

  const finishHoldGesture = (event: GestureResponderEvent, end: boolean) => {
    clearNamePeekTimer();
    if (end) {
      onReorderTouchEnd?.(event);
    } else {
      onReorderTouchCancel?.(event);
    }
    hideName();
  };

  const openDetails = () => {
    lastTapAtRef.current = 0;
    onOpenDetails?.();
  };

  return (
    <Pressable
      onPress={() => {
        if (suppressPressEpochRef.current === pressEpochRef.current) {
          suppressPressEpochRef.current = null;
          lastTapAtRef.current = 0;
          return;
        }
        if (!onOpenDetails) return;
        const now = Date.now();
        if (now - lastTapAtRef.current <= DOUBLE_TAP_MS) {
          openDetails();
          return;
        }
        lastTapAtRef.current = now;
      }}
      onPressIn={() => {
        pressEpochRef.current += 1;
        if (!stagedHold) return;
        clearNamePeekTimer();
        namePeekTimerRef.current = setTimeout(() => {
          namePeekTimerRef.current = null;
          if (!mountedRef.current) return;
          revealName();
        }, NAME_PEEK_MS);
      }}
      onLongPress={
        onLongPressReorder
          ? (event) => {
              clearNamePeekTimer();
              suppressThisPress();
              if (icon) revealName();
              onLongPressReorder(event);
            }
          : undefined
      }
      delayLongPress={reorderDelayMs}
      onTouchMove={onLongPressReorder ? onReorderTouchMove : undefined}
      onTouchEnd={
        onLongPressReorder
          ? (event) => finishHoldGesture(event, true)
          : undefined
      }
      onTouchCancel={
        onLongPressReorder
          ? (event) => finishHoldGesture(event, false)
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
      accessibilityHint={a11yHint || undefined}
      accessibilityActions={
        onOpenDetails ? [{ name: 'activate', label: t('homeIdentity.openHistoryAction') }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'activate' && onOpenDetails) {
          openDetails();
        }
      }}
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
