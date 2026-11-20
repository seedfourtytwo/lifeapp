import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { space } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import type { SheetRequest } from './confirm';
import SheetBase from './SheetBase';
import { sheetBottomPadding } from './sheetGesture';

type Props = {
  visible: boolean;
  request: SheetRequest;
  /** True for the primary button; false for Cancel, the scrim, a pull or back. */
  onAnswer: (confirmed: boolean) => void;
};

const ACTION_MIN_HEIGHT = 52;
const PRIMARY_MIN_WIDTH = 132;

/**
 * "Are you sure?" as a sheet in the editor family rather than a stock dialog:
 * the question as the title, one sentence under it, a quiet Cancel and the
 * action itself — red when it destroys something. A notice is the same sheet
 * with a single OK.
 *
 * Unlike an editor it does carry a Cancel: the whole sheet is a choice, and
 * the way out of it should be as plain as the way through.
 */
export default function ConfirmSheet({ visible, request, onAnswer }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { decorations: deco } = useAppTheme();
  const insets = useSafeAreaInsets();

  const asking = request.kind === 'confirm';
  const destructive = asking && request.destructive === true;

  return (
    <SheetBase
      testID="confirm-sheet"
      visible={visible}
      onDismiss={() => onAnswer(false)}
      title={request.title}
      paddingBottom={sheetBottomPadding({ keyboardHeight: 0, safeBottom: insets.bottom })}
    >
      <View style={styles.body}>
        {request.message ? (
          <Text style={[typeScale.body, { color: theme.colors.onSurfaceVariant }]}>
            {request.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {asking ? (
            <Button
              testID="confirm-sheet-cancel"
              mode="text"
              textColor={theme.colors.onSurface}
              onPress={() => onAnswer(false)}
              style={{ borderRadius: deco.radius.pill }}
              contentStyle={styles.actionContent}
              labelStyle={styles.actionLabel}
            >
              {request.cancelLabel ?? t('actions.cancel')}
            </Button>
          ) : null}
          <Button
            testID="confirm-sheet-primary"
            mode="contained"
            buttonColor={destructive ? theme.colors.error : undefined}
            textColor={destructive ? theme.colors.onError : undefined}
            onPress={() => onAnswer(true)}
            style={[styles.primary, { borderRadius: deco.radius.pill }]}
            contentStyle={styles.actionContent}
            labelStyle={styles.actionLabel}
          >
            {asking ? request.confirmLabel : t('actions.ok')}
          </Button>
        </View>
      </View>
    </SheetBase>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.sm,
  },
  primary: {
    minWidth: PRIMARY_MIN_WIDTH,
  },
  actionContent: {
    minHeight: ACTION_MIN_HEIGHT,
    paddingHorizontal: space.md,
  },
  actionLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
});
