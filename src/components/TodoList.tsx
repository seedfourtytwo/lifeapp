/**
 * TodoList Component
 * Main container for todo functionality with active/history views
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Text, Button, Divider } from 'react-native-paper';
import { useTodoStore } from '../store/todoStore';
import TodoInput from './TodoInput';
import TodoItem from './TodoItem';
import { Todo } from '../types';

export default function TodoList() {
  const {
    activeTodos,
    completedTodos,
    isLoading,
    showHistory,
    loadActiveTodos,
    loadCompletedTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodoComplete,
    setShowHistory,
  } = useTodoStore();

  // Load todos on mount
  useEffect(() => {
    loadActiveTodos();
    loadCompletedTodos();
  }, []);

  const handleAddTodo = async (title: string, deadline?: string, points?: number) => {
    try {
      await addTodo({ title, deadline, points: points || 5 });
    } catch (error) {
      Alert.alert('Error', 'Failed to add todo');
    }
  };

  const handleUpdateTodo = async (id: string, updates: Partial<Todo>) => {
    try {
      await updateTodo(id, updates);
    } catch (error) {
      Alert.alert('Error', 'Failed to update todo');
    }
  };

  const handleDeleteTodo = (id: string) => {
    Alert.alert(
      'Delete Todo',
      'Are you sure you want to delete this todo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTodo(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete todo');
            }
          },
        },
      ]
    );
  };

  const handleToggleComplete = async (id: string) => {
    try {
      await toggleTodoComplete(id);
    } catch (error) {
      Alert.alert('Error', 'Failed to update todo');
    }
  };

  const handleToggleHistory = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      loadCompletedTodos();
    }
  };

  const todosToDisplay = showHistory ? completedTodos : activeTodos;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.headerText}>
          {showHistory ? 'Completed (Last 30 days)' : 'Active Todos'}
        </Text>
        <View style={styles.headerActions}>
          <TodoInput onAdd={handleAddTodo} />
          <Button
            mode="text"
            onPress={handleToggleHistory}
            compact
            icon={showHistory ? 'format-list-bulleted' : 'history'}
          >
            {showHistory ? 'Active' : 'History'}
          </Button>
        </View>
      </View>

      <Divider />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Loading...
            </Text>
          </View>
        ) : todosToDisplay.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text variant="bodyMedium" style={styles.emptyText}>
              {showHistory
                ? 'No completed todos in the last 30 days'
                : 'No active todos. Add one to get started!'}
            </Text>
          </View>
        ) : (
          todosToDisplay.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggleComplete={handleToggleComplete}
              onUpdate={handleUpdateTodo}
              onDelete={handleDeleteTodo}
            />
          ))
        )}
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerText: {
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9E9E9E',
    textAlign: 'center',
  },
  footer: {
    height: 50,
  },
});
