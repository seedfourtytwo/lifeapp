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
import { Portal, Text, useTheme } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useKeyboardHeight } from '../../hooks/useDialogKeyboardLift';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { springOrSnap, timingOrSnap } from '../../utils/motion';
import SheetFooter, {
  type EditorSheetDestructiveAction,
  type EditorSheetPrimaryAction,
} from './SheetFooter';
import { dragOffset, sheetBottomPadding, shouldDismissOnRelease } from './sheetGesture';

export type { EditorSheetDestructiveAction, EditorSheetPrimaryAction };

export type EditorSheetProps = {
  visible: boolean;
  /** Scrim, a pull down, Android back and leaving the screen all land here. */
  onDismiss: () => void;
  title: string;
  /** Save, on the right of the footer. */
  primaryAction?: EditorSheetPrimaryAction;
  /** A red icon on the left of the footer — delete, clear. */
  destructiveAction?: EditorSheetDestructiveAction;
  /** False while saving: the sheet stays put rather than dropping the write. */
  dismissable?: boolean;
  children: React.ReactNode;
};

const RISE_MS = 280;
const CLOSE_MS = 200;
const GRABBER = { width: 36, height: 4 };
/** Widest a sheet grows on a tablet or a phone on its side. */
const SHEET_MAX_WIDTH = 640;

/**
 * The one editor shell: a sheet that rises from the bottom edge, with a
 * grabber, a title, a body that scrolls, and a footer that sits on the
 * keyboard holding Save. There is no Cancel — pulling it down, the scrim and
 * Android back do that, the way every other sheet on the phone works.
 *
 * It lives in a portal, which sits above the navigation stack: a screen pushed
 * over it would not cover it, so it closes itself when its own screen loses
 * focus. Only the grabber and title take the pull, so a long form scrolls
 * without throwing the edit away.
 */
export default function EditorSheet({
  visible,
  onDismiss,
  title,
  primaryAction,
  destructiveAction,
  dismissable = true,
  children,
}: EditorSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { decorations: deco } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const keyboardHeight = useKeyboardHeight(visible);

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
    if (visible && !focused) onDismiss();
    // Only a change of focus should close it, not a new onDismiss identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, visible]);

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
  const bottomPadding = sheetBottomPadding({ keyboardHeight, safeBottom: insets.bottom });
  const hasFooter = primaryAction != null || destructiveAction != null;

  return (
    <Portal>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: deco.scrim, opacity: progress }]}
        >
          <Pressable
            testID="editor-sheet-scrim"
            style={StyleSheet.absoluteFill}
            onPress={dismissable ? onDismiss : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('actions.close')}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            deco.sheetShadow,
            {
              maxHeight: windowHeight - insets.top - space.xl,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: deco.radius.xl,
              borderTopRightRadius: deco.radius.xl,
              paddingBottom: hasFooter ? 0 : bottomPadding,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View
              style={[
                styles.grabber,
                { backgroundColor: theme.colors.outlineVariant, borderRadius: deco.radius.pill },
              ]}
            />
            <Text
              style={[typeScale.screenTitle, { color: theme.colors.onSurface }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {hasFooter ? (
            <SheetFooter
              testID="editor-sheet-footer"
              primaryAction={primaryAction}
              destructiveAction={destructiveAction}
              style={{ paddingBottom: bottomPadding }}
            />
          ) : null}
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
    paddingTop: 10,
    paddingBottom: space.lg + space.xs,
  },
  grabber: {
    ...GRABBER,
    alignSelf: 'center',
    marginBottom: space.lg,
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: space.xl,
    gap: space.lg,
    paddingBottom: space.sm,
  },
});
