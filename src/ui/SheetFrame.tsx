import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dragOffset, sheetBottomPadding, shouldDismissOnRelease } from '../components/sheet/sheetGesture';
import { useKeyboardHeight } from '../hooks/useDialogKeyboardLift';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { springOrSnap, timingOrSnap } from '../utils/motion';
import { GlassFill } from './GlassFill';
import { grabberSize, nightColors, nightMotion, nightRadius, nightStroke, space } from './tokens';

export type SheetFrameProps = {
  visible: boolean;
  /** The scrim, a pull down and Android back all land here. */
  onClose: () => void;
  /** False while saving: the sheet stays put rather than dropping the write. */
  dismissable?: boolean;
  /** Fill the screen's height: an editor. Otherwise the sheet is as tall as what it holds. */
  fill?: boolean;
  /** What the sheet is, for a screen reader: "Habit editor". */
  accessibilityLabel: string;
  children: React.ReactNode;
};

/** Widest a sheet grows on a tablet or a phone on its side. */
const SHEET_MAX_WIDTH = 640;

/**
 * The bottom sheet itself, as drawn in the host's layer: scrim, grabber, a
 * glass body that scrolls, kept above the keyboard. Rises and falls, or
 * snaps under reduced motion. Only the grabber takes the pull, so a long
 * form scrolls without throwing the edit away.
 */
export function SheetFrame({ visible, onClose, dismissable = true, fill = false, accessibilityLabel, children }: SheetFrameProps) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const keyboardHeight = useKeyboardHeight(visible);
  const [shown, setShown] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);

  // Read inside the pan handlers, which are made once.
  const latest = useRef({ onClose, dismissable, reduceMotion });
  latest.current = { onClose, dismissable, reduceMotion };

  useEffect(() => {
    if (visible) setShown(true);
    const animation = timingOrSnap(
      progress,
      {
        toValue: visible ? 1 : 0,
        duration: visible ? nightMotion.rise : nightMotion.fall,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      },
      reduceMotion,
    );
    animation.start(({ finished }) => {
      if (!finished || visible) return;
      drag.setValue(0);
      setShown(false);
    });
    return () => animation.stop();
  }, [visible, progress, drag, reduceMotion]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (latest.current.dismissable) latest.current.onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > space.xs && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => drag.setValue(dragOffset(g.dy)),
        onPanResponderRelease: (_e, g) => {
          const close =
            latest.current.dismissable && shouldDismissOnRelease({ dy: g.dy, vy: g.vy, sheetHeight: sheetHeight.current });
          if (close) {
            latest.current.onClose();
            return;
          }
          springOrSnap(drag, { toValue: 0, bounciness: 0, useNativeDriver: true }, latest.current.reduceMotion).start();
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [drag],
  );

  if (!shown) return null;

  const maxHeight = windowHeight - insets.top - space.xl;
  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }), drag);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, sheetFrameStyles.scrim, { opacity: progress }]}>
        <Pressable
          testID="sheet-scrim"
          style={StyleSheet.absoluteFill}
          onPress={dismissable ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('actions.close')}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        onLayout={(e) => {
          sheetHeight.current = e.nativeEvent.layout.height;
        }}
        style={[
          sheetFrameStyles.sheet,
          fill ? { minHeight: maxHeight } : null,
          {
            maxHeight,
            paddingBottom: sheetBottomPadding({ keyboardHeight, safeBottom: insets.bottom }),
            transform: [{ translateY }],
          },
        ]}
      >
        <GlassFill />
        <View style={sheetFrameStyles.edge} pointerEvents="none" />
        <View {...pan.panHandlers} style={sheetFrameStyles.handle} testID="sheet-grabber">
          <View style={sheetFrameStyles.grabber} />
        </View>
        <ScrollView
          style={sheetFrameStyles.body}
          contentContainerStyle={[sheetFrameStyles.bodyContent, fill ? sheetFrameStyles.fillContent : null]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export const sheetFrameStyles = StyleSheet.create({
  scrim: {
    backgroundColor: nightColors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: nightColors.glassMiddle,
    borderTopLeftRadius: nightRadius.sheet,
    borderTopRightRadius: nightRadius.sheet,
  },
  edge: {
    position: 'absolute',
    top: 0,
    left: nightRadius.sheet,
    right: nightRadius.sheet,
    borderTopWidth: nightStroke.quiet,
    borderTopColor: nightColors.glassEdge,
  },
  handle: {
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  grabber: {
    ...grabberSize,
    alignSelf: 'center',
    borderRadius: nightRadius.pill,
    backgroundColor: nightColors.grabber,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  fillContent: {
    flexGrow: 1,
  },
});
