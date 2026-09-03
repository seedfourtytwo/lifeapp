import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Portal, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { timingOrSnap } from '../utils/motion';
import QuietText from './QuietText';

export type HeaderPeekSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Sheet heading — what this peek is about. Never the date. */
  title: string;
  /**
   * Makes the heading a button, with a chevron: the calendar peek uses it to
   * hand off to the full screen.
   */
  onTitlePress?: () => void;
  titleA11yLabel?: string;
  /** One quiet line under the heading. */
  subtitle?: string | null;
  /** Buttons pinned under the body. */
  footer?: React.ReactNode;
  /** Share of the window the sheet may take before its body scrolls. */
  maxHeightRatio?: number;
  children: React.ReactNode;
};

/** How far the sheet travels on the way in. */
const RISE_PX = 24;
const OPEN_MS = 200;

/**
 * The one bottom sheet the day header opens.
 *
 * Both header glyphs — weather and calendar — lead to the same kind of panel:
 * a heading, a quiet line, a small body, a row of buttons. Written once so the
 * two peeks cannot drift apart, and so safe-area insets, the back button and
 * "remove animations" are answered in a single place.
 *
 * Paper's `Modal` centres its content and reserves the bottom inset as a
 * margin; both are overridden here so the sheet sits flush against the bottom
 * edge and pads its own contents clear of the navigation bar instead.
 */
export default function HeaderPeekSheet({
  visible,
  onDismiss,
  title,
  onTitlePress,
  titleA11yLabel,
  subtitle = null,
  footer,
  maxHeightRatio = 0.7,
  children,
}: HeaderPeekSheetProps) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // The sheet still arrives and leaves; reduced motion drops the travel and
    // keeps the end state, so an open sheet is open either way.
    timingOrSnap(
      rise,
      {
        toValue: visible ? 1 : 0,
        duration: OPEN_MS,
        useNativeDriver: true,
      },
      reduceMotion,
    ).start();
  }, [visible, rise, reduceMotion]);

  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [RISE_PX, 0],
  });

  const accent = isCartoon ? theme.colors.secondary : theme.colors.primary;

  const heading = (
    <>
      <Text
        style={[typeScale.screenTitle, { color: theme.colors.onSurface }]}
        accessibilityRole={onTitlePress ? undefined : 'header'}
        numberOfLines={1}
      >
        {title}
      </Text>
      {onTitlePress ? (
        <MaterialCommunityIcons name="chevron-right" size={22} color={accent} />
      ) : null}
    </>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        style={styles.wrapper}
        contentContainerStyle={styles.contentContainer}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: Math.round(windowHeight * maxHeightRatio),
              paddingBottom: space.lg + insets.bottom,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: deco.radius.xl,
              borderTopRightRadius: deco.radius.xl,
              transform: [{ translateY }],
              ...(deco.headerBorderWidth > 0 && {
                borderTopWidth: deco.headerBorderWidth,
                borderColor: theme.colors.outline,
              }),
            },
          ]}
        >
          {onTitlePress ? (
            <Pressable
              onPress={onTitlePress}
              style={styles.headingRow}
              accessibilityRole="button"
              accessibilityLabel={titleA11yLabel ?? title}
            >
              {heading}
            </Pressable>
          ) : (
            <View style={styles.headingRow}>{heading}</View>
          )}

          {subtitle ? (
            <QuietText variant="bodySmall" style={styles.subtitle}>
              {subtitle}
            </QuietText>
          ) : null}

          <View style={styles.body}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'flex-end',
    // Paper reserves the bottom inset here; the sheet pads its own contents.
    marginBottom: 0,
  },
  contentContainer: {
    // The sheet below owns the surface; this layer only positions it.
    backgroundColor: 'transparent',
  },
  sheet: {
    width: '100%',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: 32,
  },
  subtitle: {
    marginTop: space.xxs,
  },
  body: {
    flexShrink: 1,
    marginTop: space.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    minHeight: 40,
  },
});
