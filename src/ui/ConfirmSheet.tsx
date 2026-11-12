import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NightText } from './NightText';
import { Overlay } from './Overlay';
import { PillButton } from './PillButton';
import { SheetFrame } from './SheetFrame';
import { space } from './tokens';

export type ConfirmRequest = {
  /** The question: "Erase everything?" */
  title: string;
  /** One line on what cannot be undone. The only helper text the kit allows. */
  line?: string;
  /** The verb that does it: "Erase", "Delete". */
  action: string;
};

type Props = ConfirmRequest & {
  visible: boolean;
  onConfirm: () => void;
  /** Cancel, the scrim, a pull down and Android back. */
  onCancel: () => void;
};

/**
 * The bottom confirm, for the few things that cannot be undone: a title,
 * one line, the destructive action and Cancel. Everything else acts at once
 * and offers Undo instead. Usually reached through `useConfirm()`.
 */
export function ConfirmSheet(props: Props) {
  return (
    <Overlay layer="confirm" modal={props.visible}>
      <ConfirmFrame {...props} />
    </Overlay>
  );
}

/** The confirm as drawn in its layer. The KitHost draws its own through this, outside the portal. */
export function ConfirmFrame({ visible, title, line, action, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('common');
  return (
    <SheetFrame visible={visible} onClose={onCancel} accessibilityLabel={title}>
      <View style={confirmSheetStyles.words}>
        <NightText kind="title" accessibilityRole="header">
          {title}
        </NightText>
        {line ? (
          <NightText kind="body" tone="dim">
            {line}
          </NightText>
        ) : null}
      </View>
      <View style={confirmSheetStyles.buttons}>
        <View style={confirmSheetStyles.button}>
          <PillButton variant="quiet" label={t('actions.cancel')} onPress={onCancel} />
        </View>
        <View style={confirmSheetStyles.button}>
          <PillButton variant="danger" label={action} onPress={onConfirm} />
        </View>
      </View>
    </SheetFrame>
  );
}

export const confirmSheetStyles = StyleSheet.create({
  words: {
    gap: space.sm,
    paddingHorizontal: space.xs,
    paddingBottom: space.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: space.md,
  },
  button: {
    flexGrow: 1,
    flexBasis: 0,
  },
});
