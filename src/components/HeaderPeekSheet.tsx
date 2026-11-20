import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme/spacing';
import { SheetBase } from './sheet';
import { sheetBottomPadding } from './sheet/sheetGesture';

export type HeaderPeekSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Sheet heading — what this peek is about. Never the date. */
  title: string;
  /** One quiet line under the heading. */
  subtitle?: string | null;
  /** Buttons pinned under the body. */
  footer?: React.ReactNode;
  /** Share of the window the sheet may take before its body scrolls. */
  maxHeightRatio?: number;
  children: React.ReactNode;
};

const FOOTER_MIN_HEIGHT = 48;

/**
 * The one bottom sheet the day header opens.
 *
 * Both header glyphs — weather and calendar — lead to the same kind of panel:
 * a heading, a quiet line, a small body, a row of buttons. It is the editor
 * sheet's shell (`SheetBase`) at a shorter height, so it rises, dims the
 * screen, pulls down and answers the back button exactly as an editor does.
 */
export default function HeaderPeekSheet({
  visible,
  onDismiss,
  title,
  subtitle = null,
  footer,
  maxHeightRatio = 0.7,
  children,
}: HeaderPeekSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <SheetBase
      testID="peek-sheet"
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      titleLines={1}
      maxHeight={Math.round(windowHeight * maxHeightRatio)}
      paddingBottom={sheetBottomPadding({ keyboardHeight: 0, safeBottom: insets.bottom })}
    >
      <View testID="peek-sheet-body" style={styles.body}>
        {children}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SheetBase>
  );
}

const styles = StyleSheet.create({
  body: {
    flexShrink: 1,
    paddingHorizontal: space.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    marginTop: space.lg,
    minHeight: FOOTER_MIN_HEIGHT,
  },
});
