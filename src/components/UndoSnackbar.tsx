import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Snackbar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../hooks/useAppTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { DOCK_RESERVE } from '../ui/homeInsets';

/** Long enough to notice a slip and reach Undo; short enough not to linger. */
export const UNDO_DURATION_MS = 5000;

/** Rounder than a tile corner, squarer than a pill: it is a bar, not a button. */
const BAR_RADIUS = 16;

type Props = {
  /** What just happened, e.g. "Water +3". `null` hides the bar. */
  message: string | null;
  onUndo: () => void;
  onDismiss: () => void;
  /** Lift clear of the Home dock (Home tabs); pushed screens have no dock. */
  aboveDock?: boolean;
};

/**
 * "Done — Undo" instead of "Are you sure?". The action happens at once and the
 * bar offers the way back, which costs a tap only when it was a mistake.
 *
 * The one inverse surface in the app: ink-dark in light, pale in dark, floating
 * on the sheet shadow a gutter clear of the edges. Its Undo is the inverse
 * moss, so the way back reads as the one thing to press.
 *
 * In a Portal: rendered inside a Home tab it lands under the dock, where Undo
 * cannot be tapped at all.
 */
export function UndoSnackbar({ message, onUndo, onDismiss, aboveDock = true }: Props) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  return (
    <Portal>
      <Snackbar
        testID="undo-bar"
        visible={message != null}
        onDismiss={onDismiss}
        duration={UNDO_DURATION_MS}
        elevation={0}
        // Paper fades and scales the bar in; "remove animations" snaps it.
        theme={{ animation: { scale: reduceMotion ? 0 : 1 } }}
        wrapperStyle={[
          styles.wrapper,
          { bottom: (aboveDock ? DOCK_RESERVE : 0) + insets.bottom + space.lg },
        ]}
        style={[styles.bar, deco.sheetShadow, { backgroundColor: theme.colors.inverseSurface }]}
        // Paper paints the action in inversePrimary: the moss of the other theme.
        action={{ label: t('actions.undo'), onPress: onUndo }}
      >
        <Text
          numberOfLines={1}
          style={[typeScale.secondary, { color: theme.colors.inverseOnSurface }]}
        >
          {message ?? ''}
        </Text>
      </Snackbar>
    </Portal>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: space.lg,
  },
  bar: {
    margin: 0,
    borderRadius: BAR_RADIUS,
  },
});
