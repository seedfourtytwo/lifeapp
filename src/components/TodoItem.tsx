/**
 * TodoItem Component
 * Displays a single todo item with edit/delete/complete actions
 */

import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, Checkbox, IconButton, TextInput, Chip } from 'react-native-paper';
import { Todo } from '../types';
import { formatDate } from '../services/storageService';

interface TodoItemProps {
  todo: Todo;
  onToggleComplete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggleComplete, onUpdate, onDelete }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(todo.title);

  const handleSaveEdit = () => {
    if (editedTitle.trim() && editedTitle !== todo.title) {
      onUpdate(todo.id, { title: editedTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(todo.title);
    setIsEditing(false);
  };

  // Check if deadline is overdue
  const isOverdue = () => {
    if (!todo.deadline || todo.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(todo.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    return deadlineDate < today;
  };

  // Check if deadline is today
  const isToday = () => {
    if (!todo.deadline) return false;
    const today = formatDate(new Date());
    return todo.deadline === today;
  };

  const getDeadlineColor = () => {
    if (todo.completed) return '#9E9E9E';
    if (isOverdue()) return '#F44336';
    if (isToday()) return '#FF9800';
    return '#4CAF50';
  };

  return (
    <View style={styles.container}>
      <Checkbox
        status={todo.completed ? 'checked' : 'unchecked'}
        onPress={() => onToggleComplete(todo.id)}
        color="#4CAF50"
      />

      <View style={styles.content}>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              mode="outlined"
              value={editedTitle}
              onChangeText={setEditedTitle}
              style={styles.editInput}
              autoFocus
              onSubmitEditing={handleSaveEdit}
              dense
            />
            <IconButton icon="check" size={20} onPress={handleSaveEdit} />
            <IconButton icon="close" size={20} onPress={handleCancelEdit} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.titleContainer}
            onPress={() => setIsEditing(true)}
            disabled={todo.completed}
          >
            <Text
              variant="bodyLarge"
              style={[
                styles.title,
                todo.completed && styles.completedTitle,
              ]}
            >
              {todo.title}
            </Text>

            {todo.deadline && (
              <View style={styles.metaContainer}>
                <Chip
                  mode="outlined"
                  compact
                  style={[styles.chip, { borderColor: getDeadlineColor() }]}
                  textStyle={{ color: getDeadlineColor(), fontSize: 11 }}
                  icon="calendar"
                >
                  {todo.deadline}
                  {isOverdue() && ' (overdue)'}
                  {isToday() && ' (today)'}
                </Chip>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!isEditing && (
        <IconButton
          icon="delete"
          size={20}
          onPress={() => onDelete(todo.id)}
          iconColor="#F44336"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    marginHorizontal: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#9E9E9E',
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    height: 24,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editInput: {
    flex: 1,
    height: 40,
  },
});
