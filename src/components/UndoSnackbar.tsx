import React from 'react';
import { Portal, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DOCK_RESERVE } from '../ui/homeInsets';

/** Long enough to notice a slip and reach Undo; short enough not to linger. */
export const UNDO_DURATION_MS = 5000;

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
 * In a Portal: rendered inside a Home tab it lands under the dock, where Undo
 * cannot be tapped at all.
 */
export function UndoSnackbar({ message, onUndo, onDismiss, aboveDock = true }: Props) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  return (
    <Portal>
      <Snackbar
        visible={message != null}
        onDismiss={onDismiss}
        duration={UNDO_DURATION_MS}
        wrapperStyle={{ bottom: (aboveDock ? DOCK_RESERVE : 0) + insets.bottom }}
        action={{ label: t('actions.undo'), onPress: onUndo }}
      >
        {message ?? ''}
      </Snackbar>
    </Portal>
  );
}
