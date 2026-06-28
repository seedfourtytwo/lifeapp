import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { CounterConfigSchema } from '../protocol';
import { useElementStore } from '../store/elementStore';

export default function ElementsScreen() {
  const {
    elements,
    dashboard,
    isLoading,
    load,
    createCounter,
    updateCounter,
    pinToDashboard,
    unpinFromDashboard,
  } = useElementStore();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [increments, setIncrements] = useState('5, 10');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const pinnedElementIds = new Set(dashboard.map((d) => d.elementId));

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setIncrements('5, 10');
    setDialogVisible(true);
  };

  const openEdit = (id: string, currentName: string, quickIncrements: number[]) => {
    setEditingId(id);
    setName(currentName);
    setIncrements(quickIncrements.join(', '));
    setDialogVisible(true);
  };

  const parseIncrements = (raw: string): number[] => {
    const values = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (values.length === 0) {
      throw new Error('Enter at least one positive number (e.g. 5, 10)');
    }
    return values;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const quickIncrements = parseIncrements(increments);
      if (editingId) {
        await updateCounter(editingId, name, quickIncrements);
      } else {
        await createCounter(name, quickIncrements);
      }
      setDialogVisible(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const getDashboardItemId = useCallback(
    (elementId: string) => dashboard.find((d) => d.elementId === elementId)?.id,
    [dashboard],
  );

  if (isLoading && elements.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        {elements.map((element) => {
          if (element.kind !== 'counter') return null;
          const config = CounterConfigSchema.parse(element.config);
          const isPinned = pinnedElementIds.has(element.id);
          const dashboardItemId = getDashboardItemId(element.id);

          return (
            <Card key={element.id} style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{element.name}</Text>
                <View style={styles.chips}>
                  <Chip compact>{element.kind}</Chip>
                  <Chip compact>{element.category}</Chip>
                  {isPinned ? <Chip compact icon="pin">Dashboard</Chip> : null}
                </View>
                <Text variant="bodySmall" style={styles.meta}>
                  Buttons: {config.quickIncrements.map((n) => `+${n}`).join(', ')}
                </Text>
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => openEdit(element.id, element.name, config.quickIncrements)}>
                  Edit
                </Button>
                {isPinned && dashboardItemId ? (
                  <Button onPress={() => void unpinFromDashboard(dashboardItemId)}>
                    Unpin
                  </Button>
                ) : (
                  <Button onPress={() => void pinToDashboard(element.id)}>Pin</Button>
                )}
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>

      <Button mode="contained" onPress={openCreate} style={styles.fab}>
        New counter
      </Button>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editingId ? 'Edit counter' : 'New counter'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
            <TextInput
              label="Quick increments (comma-separated)"
              value={increments}
              onChangeText={setIncrements}
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button loading={saving} onPress={() => void handleSave()} disabled={!name.trim()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, paddingBottom: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  meta: { marginTop: 8, opacity: 0.6 },
  fab: { margin: 16 },
  input: { marginBottom: 8 },
});
