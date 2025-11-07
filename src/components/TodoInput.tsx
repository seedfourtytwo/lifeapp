/**
 * TodoInput Component
 * Input form for adding new todo items
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput, Button, Text, IconButton, Dialog, Portal } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../services/storageService';

interface TodoInputProps {
  onAdd: (title: string, deadline?: string, points?: number) => void;
}

export default function TodoInput({ onAdd }: TodoInputProps) {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);

  const handleAdd = () => {
    if (title.trim()) {
      const deadlineStr = deadline ? formatDate(deadline) : undefined;
      onAdd(title.trim(), deadlineStr, 5); // Default 5 points

      // Reset form
      setTitle('');
      setDeadline(undefined);
      setVisible(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDeadline(undefined);
    setVisible(false);
  };

  const handleDateChange = (event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDeadline(selectedDate);
    }
  };

  const clearDeadline = () => {
    setDeadline(undefined);
  };

  return (
    <>
      <IconButton
        icon="plus"
        size={18}
        onPress={() => setVisible(true)}
        iconColor="#4CAF50"
        style={styles.addButton}
      />

      <Portal>
        <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
          <Dialog.Title>Add Todo</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              placeholder="What needs to be done?"
              value={title}
              onChangeText={setTitle}
              style={styles.titleInput}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              autoFocus
            />

            <View style={styles.optionsRow}>
              {deadline ? (
                <View style={styles.deadlineChip}>
                  <Text variant="bodySmall" style={styles.deadlineText}>
                    {formatDate(deadline)}
                  </Text>
                  <IconButton icon="close" size={16} onPress={clearDeadline} style={styles.closeIcon} />
                </View>
              ) : (
                <Button
                  mode="text"
                  icon="calendar"
                  onPress={() => setShowDatePicker(true)}
                  compact
                  style={styles.optionButton}
                >
                  Deadline
                </Button>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancel}>Cancel</Button>
            <Button mode="contained" onPress={handleAdd} disabled={!title.trim()}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {showDatePicker && (
        <DateTimePicker
          value={deadline || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    margin: 0,
  },
  dialog: {
    maxHeight: '80%',
  },
  titleInput: {
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  optionButton: {
    marginLeft: -8,
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  deadlineText: {
    color: '#4CAF50',
  },
  closeIcon: {
    margin: 0,
  },
});
