import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

type Props = {
  name: string;
  chips: React.ReactNode;
  metaLines: string[];
  isPinned: boolean;
  deleteLabel: string;
  dashboardItemId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onUnpin: () => void;
};

export default function ElementLibraryCard({
  name,
  chips,
  metaLines,
  isPinned,
  deleteLabel,
  dashboardItemId,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
}: Props) {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();

  return (
    <Card
      style={[
        styles.card,
        isCartoon && {
          borderWidth: deco.cardBorderWidth,
          borderColor: theme.colors.outline,
          borderRadius: deco.radius.md,
        },
      ]}
    >
      <Card.Content>
        <Text variant="titleMedium">{name}</Text>
        <View style={styles.chips}>
          {chips}
          {isPinned ? <Chip compact icon="pin">Pinned</Chip> : null}
        </View>
        {metaLines.map((line, index) => (
          <Text key={`${line}-${index}`} variant="bodySmall" style={styles.meta}>
            {line}
          </Text>
        ))}
      </Card.Content>
      <Card.Actions style={styles.cardActions}>
        <Button compact onPress={onEdit}>
          Edit
        </Button>
        <Button compact textColor={theme.colors.error} onPress={onDelete}>
          {deleteLabel}
        </Button>
        {isPinned && dashboardItemId ? (
          <Button compact onPress={onUnpin}>
            Unpin
          </Button>
        ) : (
          <Button compact onPress={onPin}>
            Pin
          </Button>
        )}
      </Card.Actions>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  meta: { marginTop: 8, opacity: 0.6 },
  cardActions: {
    flexWrap: 'wrap',
    gap: 4,
  },
});
