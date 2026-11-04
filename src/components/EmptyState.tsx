import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { space } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import QuietText from './QuietText';

type Props = {
  /** One plain sentence: what is missing, not an instruction manual. */
  message: string;
  /** The one thing to do about it, if there is one. */
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * What a list shows when it has nothing in it: a tile where the rows would
 * be, one quiet sentence, and at most one quiet way forward. It takes the
 * place of the list rather than floating in the middle of the screen, so the
 * page keeps its shape whether it is full or empty.
 */
export default function EmptyState({ message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const hasAction = actionLabel != null && onAction != null;
  return (
    <View
      testID="empty-state"
      style={[
        styles.tile,
        { backgroundColor: theme.colors.surface, borderRadius: deco.radius.lg },
      ]}
    >
      <QuietText style={typeScale.secondary}>{message}</QuietText>
      {hasAction ? (
        <Button
          testID="empty-state-action"
          mode="text"
          compact
          onPress={onAction}
          style={styles.action}
          labelStyle={styles.actionLabel}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    gap: space.xs,
  },
  action: {
    alignSelf: 'flex-start',
    // Pulls the label in line with the sentence above; the touch area stays.
    marginLeft: -space.sm,
  },
  actionLabel: {
    ...typeScale.secondary,
    fontWeight: '500',
  },
});
