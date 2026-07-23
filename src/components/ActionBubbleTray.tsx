import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../i18n';
import { useAppTheme } from '../hooks/useAppTheme';
import { DOCK_RESERVE, EDGE_PAD } from '../ui/homeInsets';

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
};

const BUBBLE_SIZE = 48;
/** Clear air between the control bottom and the bubble row. */
const TRAY_GAP = 12;
const BUBBLE_GAP = 8;
const MIN_ANCHOR = 48;

/**
 * Floating long-press bubbles below the anchor (flip above near the dock).
 * Measures the anchor *before* the Modal mounts — measuring under an open
 * Modal is unreliable on Android and parked the tray on the button.
 */
export function ActionBubbleTray({
  open,
  onDismiss,
  bubbles,
  children,
}: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchorRef = useRef<View>(null);
  const anchorSizeRef = useRef({ width: MIN_ANCHOR, height: MIN_ANCHOR });
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }

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

      setPlacement({ top, left });
    });
  }, [
    open,
    bubbles.length,
    windowWidth,
    windowHeight,
    insets.bottom,
    insets.top,
  ]);

  if (bubbles.length === 0) {
    return <>{children}</>;
  }

  const bubbleBg = theme.colors.primaryContainer;
  const bubbleFg = theme.colors.onPrimaryContainer;
  const modalVisible = open && placement != null;

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
        visible={modalVisible}
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
            <View
              style={[
                styles.tray,
                {
                  top: placement.top,
                  left: placement.left,
                },
              ]}
              accessibilityRole="menu"
              pointerEvents="box-none"
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
                      borderRadius: Math.max(deco.radius.lg, 24),
                      opacity: pressed ? 0.85 : 1,
                      borderColor: theme.colors.outline,
                      borderWidth: StyleSheet.hairlineWidth,
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
            </View>
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
