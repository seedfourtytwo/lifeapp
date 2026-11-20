import React, { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../../hooks/useDialogKeyboardLift';
import { space } from '../../theme/spacing';
import SheetBase from './SheetBase';
import SheetFooter, {
  type EditorSheetDestructiveAction,
  type EditorSheetPrimaryAction,
} from './SheetFooter';
import { sheetBottomPadding } from './sheetGesture';

export type { EditorSheetDestructiveAction, EditorSheetPrimaryAction };

export type EditorSheetProps = {
  visible: boolean;
  /** Scrim, a pull down, Android back and leaving the screen all land here. */
  onDismiss: () => void;
  title: string;
  /** One quiet line under the title, for a sheet that needs explaining. */
  subtitle?: string | null;
  /** Save, on the right of the footer. */
  primaryAction?: EditorSheetPrimaryAction;
  /** A red icon on the left of the footer — delete, clear. */
  destructiveAction?: EditorSheetDestructiveAction;
  /** False while saving: the sheet stays put rather than dropping the write. */
  dismissable?: boolean;
  /** Reaches the scrolling body, so a form can bring a field into view. */
  scrollRef?: React.Ref<ScrollView>;
  children: React.ReactNode;
};

/**
 * The one editor shell: a sheet that rises from the bottom edge, with a
 * grabber, a title, a body that scrolls, and a footer that sits on the
 * keyboard holding Save. There is no Cancel — pulling it down, the scrim and
 * Android back do that, the way every other sheet on the phone works.
 *
 * The shell itself is `SheetBase`. That lives in a portal, which sits above the
 * navigation stack: a screen pushed over it would not cover it, so an editor
 * closes itself when its own screen loses focus. Only the grabber and title
 * take the pull, so a long form scrolls without throwing the edit away.
 */
export default function EditorSheet({
  visible,
  onDismiss,
  title,
  subtitle,
  primaryAction,
  destructiveAction,
  dismissable = true,
  scrollRef,
  children,
}: EditorSheetProps) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const keyboardHeight = useKeyboardHeight(visible);

  useEffect(() => {
    if (visible && !focused) onDismiss();
    // Only a change of focus should close it, not a new onDismiss identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, visible]);

  const bottomPadding = sheetBottomPadding({ keyboardHeight, safeBottom: insets.bottom });
  const hasFooter = primaryAction != null || destructiveAction != null;

  return (
    <SheetBase
      testID="editor-sheet"
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      dismissable={dismissable}
      paddingBottom={hasFooter ? 0 : bottomPadding}
    >
      <ScrollView
        ref={scrollRef}
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
    </SheetBase>
  );
}

const styles = StyleSheet.create({
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: space.xl,
    gap: space.lg,
    paddingBottom: space.sm,
  },
});
