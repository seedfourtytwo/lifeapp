import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../i18n';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { space } from '../theme/spacing';
import { DOCK_RESERVE, EDGE_PAD } from '../ui/homeInsets';
import { timingOrSnap } from '../utils/motion';

export type ActionBubble = {
  key: string;
  /** Text label inside the bubble (e.g. "+5"). */
  label?: string;
  /** MaterialCommunityIcons name when no label. */
  icon?: string;
  accessibilityLabel: string;
  onPress: () => void;
};

type Props = {
  open: boolean;
  onDismiss: () => void;
  bubbles: ActionBubble[];
  children: React.ReactNode;
};

type Placement = {
  top: number;
  left: number;
  /** Which side of the tray faces the control it grew out of. */
  below: boolean;
};

const BUBBLE_SIZE = 48;
/** Clear air between the control bottom and the bubble row. */
const TRAY_GAP = space.md;
const BUBBLE_GAP = space.sm;
const MIN_ANCHOR = 48;
/** Quick enough to feel attached to the press that opened it. */
const POP_MS = 140;
/** Where the tray starts from: nearly full size, so it grows rather than flies in. */
const POP_FROM_SCALE = 0.8;

/**
 * Floating long-press bubbles below the anchor (flip above near the dock).
 * Measures the anchor *before* the Modal mounts — measuring under an open
 * Modal is unreliable on Android and parked the tray on the button.
 *
 * The tray grows out of the corner nearest the control and fades in, then
 * shrinks back into it; the Modal stays up until that has finished.
 */
export function ActionBubbleTray({
  open,
  onDismiss,
  bubbles,
  children,
}: Props) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchorRef = useRef<View>(null);
  const anchorSizeRef = useRef({ width: MIN_ANCHOR, height: MIN_ANCHOR });
  const [placement, setPlacement] = useState<Placement | null>(null);
  const pop = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    // Closing keeps the last placement: the tray shrinks away where it stood.
    if (!open) return;

    const trayWidth =
      bubbles.length * BUBBLE_SIZE + Math.max(0, bubbles.length - 1) * BUBBLE_GAP;

    // Modal stays closed until placement is set, so the button is still measurable.
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      const anchorW = Math.max(
        width,
        anchorSizeRef.current.width,
        MIN_ANCHOR,
      );
      const anchorH = Math.max(
        height,
        anchorSizeRef.current.height,
        MIN_ANCHOR,
      );
      // Always prefer below the control; flip above only when it would cover the dock.
      const belowTop = y + anchorH + TRAY_GAP;
      const aboveTop = y - TRAY_GAP - BUBBLE_SIZE;
      const bottomLimit = windowHeight - insets.bottom - DOCK_RESERVE;
      const fitsBelow = belowTop + BUBBLE_SIZE <= bottomLimit;
      const top = fitsBelow
        ? belowTop
        : Math.max(insets.top + EDGE_PAD, aboveTop);

      const idealLeft = x + anchorW - trayWidth;
      const left = Math.min(
        Math.max(EDGE_PAD, idealLeft),
        windowWidth - trayWidth - EDGE_PAD,
      );

      setPlacement({ top, left, below: fitsBelow });
    });
  }, [
    open,
    bubbles.length,
    windowWidth,
    windowHeight,
    insets.bottom,
    insets.top,
  ]);

  const placed = placement != null;
  useEffect(() => {
    if (!placed) return;
    const animation = timingOrSnap(
      pop,
      {
        toValue: open ? 1 : 0,
        duration: POP_MS,
        easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      },
      reduceMotion,
    );
    animation.start(({ finished }) => {
      if (finished && !open) setPlacement(null);
    });
    return () => animation.stop();
  }, [open, placed, pop, reduceMotion]);

  if (bubbles.length === 0) {
    return <>{children}</>;
  }

  const bubbleBg = theme.colors.primaryContainer;
  const bubbleFg = theme.colors.onPrimaryContainer;

  return (
    <>
      <View
        ref={anchorRef}
        collapsable={false}
        style={styles.anchor}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) {
            anchorSizeRef.current = { width, height };
          }
        }}
      >
        {children}
      </View>

      <Modal
        visible={placed}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={onDismiss}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
            accessibilityLabel={i18n.t('common:actions.close')}
            accessibilityRole="button"
          />
          {placement ? (
            <Animated.View
              testID="bubble-tray"
              style={[
                styles.tray,
                {
                  top: placement.top,
                  left: placement.left,
                  transformOrigin: placement.below ? 'right top' : 'right bottom',
                  opacity: pop,
                  transform: [
                    {
                      scale: pop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [POP_FROM_SCALE, 1],
                      }),
                    },
                  ],
                },
              ]}
              accessibilityRole="menu"
              pointerEvents={open ? 'box-none' : 'none'}
            >
              {bubbles.map((bubble) => (
                <Pressable
                  key={bubble.key}
                  onPress={() => {
                    onDismiss();
                    bubble.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.bubble,
                    {
                      backgroundColor: bubbleBg,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={bubble.accessibilityLabel}
                >
                  {bubble.label ? (
                    <Text style={[styles.bubbleLabel, { color: bubbleFg }]}>
                      {bubble.label}
                    </Text>
                  ) : bubble.icon ? (
                    <Icon source={bubble.icon} size={22} color={bubbleFg} />
                  ) : null}
                </Pressable>
              ))}
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignSelf: 'flex-end',
  },
  modalRoot: {
    flex: 1,
  },
  tray: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BUBBLE_GAP,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    // Geometry: half the size is what makes it a disc.
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  bubbleLabel: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
