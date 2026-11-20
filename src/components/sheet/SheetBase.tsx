import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { springOrSnap, timingOrSnap } from '../../utils/motion';
import QuietText from '../QuietText';
import { dragOffset, shouldDismissOnRelease } from './sheetGesture';

export type SheetBaseProps = {
  visible: boolean;
  /** Scrim, a pull down and Android back all land here. */
  onDismiss: () => void;
  title: string;
  /** One quiet line under the title. */
  subtitle?: string | null;
  /** False while a write is in flight: the sheet stays put. */
  dismissable?: boolean;
  /** Tallest the sheet grows; defaults to the window less the status bar. */
  maxHeight?: number;
  /** Room under the contents — the navigation bar, or the keyboard. */
  paddingBottom: number;
  /** A long title wraps unless a sheet asks for one line. */
  titleLines?: number;
  /** Names the sheet, and its `-scrim` and `-grabber`, for tests. */
  testID: string;
  children: React.ReactNode;
};

const RISE_MS = 280;
const CLOSE_MS = 200;
const GRABBER = { width: 36, height: 4 };
/** Widest a sheet grows on a tablet or a phone on its side. */
const SHEET_MAX_WIDTH = 640;

/**
 * What every bottom sheet in the app is made of: the scrim, the rise from the
 * bottom edge, the corner radius and shadow, a grabber and a title that take
 * the pull-down, and the Android back button. Editors, the header peeks and
 * the confirmation sheet all sit on it, so none of them can drift apart.
 *
 * It lives in a portal, above the navigation stack. What goes under the title
 * — a scrolling form, a row of buttons — is the caller's.
 */
export default function SheetBase({
  visible,
  onDismiss,
  title,
  subtitle = null,
  dismissable = true,
  maxHeight,
  paddingBottom,
  titleLines,
  testID,
  children,
}: SheetBaseProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { decorations: deco } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);

  // Read inside the pan handlers, which are created once.
  const latest = useRef({ onDismiss, dismissable, reduceMotion });
  latest.current = { onDismiss, dismissable, reduceMotion };

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = timingOrSnap(
      progress,
      {
        toValue: visible ? 1 : 0,
        duration: visible ? RISE_MS : CLOSE_MS,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      },
      reduceMotion,
    );
    animation.start(({ finished }) => {
      if (!finished || visible) return;
      drag.setValue(0);
      setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress, drag, reduceMotion]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (latest.current.dismissable) latest.current.onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => drag.setValue(dragOffset(g.dy)),
        onPanResponderRelease: (_e, g) => {
          const close =
            latest.current.dismissable &&
            shouldDismissOnRelease({ dy: g.dy, vy: g.vy, sheetHeight: sheetHeight.current });
          if (close) {
            latest.current.onDismiss();
            return;
          }
          springOrSnap(
            drag,
            { toValue: 0, bounciness: 0, useNativeDriver: true },
            latest.current.reduceMotion,
          ).start();
        },
        onPanResponderTerminate: () => drag.setValue(0),
      }),
    [drag],
  );

  if (!mounted) return null;

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] }),
    drag,
  );

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: deco.scrim, opacity: progress }]}
        >
          <Pressable
            testID={`${testID}-scrim`}
            style={StyleSheet.absoluteFill}
            onPress={dismissable ? onDismiss : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('actions.close')}
          />
        </Animated.View>

        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            deco.sheetShadow,
            {
              maxHeight: maxHeight ?? windowHeight - insets.top - space.xl,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: deco.radius.xl,
              borderTopRightRadius: deco.radius.xl,
              paddingBottom,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View
              testID={`${testID}-grabber`}
              style={[
                styles.grabber,
                { backgroundColor: theme.colors.outlineVariant, borderRadius: deco.radius.pill },
              ]}
            />
            <Text
              style={[typeScale.screenTitle, { color: theme.colors.onSurface }]}
              accessibilityRole="header"
              numberOfLines={titleLines}
            >
              {title}
            </Text>
            {subtitle ? (
              <QuietText style={[typeScale.secondary, styles.subtitle]}>{subtitle}</QuietText>
            ) : null}
          </View>

          {children}
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: 'center',
  },
  handleArea: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm + space.xxs,
    paddingBottom: space.lg + space.xs,
  },
  grabber: {
    ...GRABBER,
    alignSelf: 'center',
    marginBottom: space.lg,
  },
  subtitle: {
    marginTop: space.xs,
  },
});
