/**
 * SettingsScreen
 * Manage activities (add, edit, delete, reorder)
 */

import React, { useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Text, List, FAB, IconButton, TextInput, Button, Dialog, Portal } from 'react-native-paper';
import { useActivityStore } from '../store/activityStore';
import { Activity } from '../types';

const AVAILABLE_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3',
  '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B',
  '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B', '#9E9E9E',
];

const AVAILABLE_ICONS = [
  'sleep', 'book-open-variant', 'dumbbell', 'school', 'briefcase', 'meditation',
  'silverware-fork-knife', 'broom', 'dots-horizontal', 'coffee', 'laptop',
  'music', 'run', 'bike', 'walk', 'gamepad-variant', 'television',
  'phone', 'camera', 'palette', 'hammer', 'cart', 'car', 'airplane',
];

export default function SettingsScreen() {
  const { activities, addActivity, updateActivity, deleteActivity } = useActivityStore();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityName, setActivityName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);

  const openAddDialog = () => {
    setEditingActivity(null);
    setActivityName('');
    setSelectedColor(AVAILABLE_COLORS[0]);
    setSelectedIcon(AVAILABLE_ICONS[0]);
    setDialogVisible(true);
  };

  const openEditDialog = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityName(activity.name);
    setSelectedColor(activity.color);
    setSelectedIcon(activity.icon);
    setDialogVisible(true);
  };

  const handleSave = async () => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Please enter an activity name');
      return;
    }

    try {
      if (editingActivity) {
        // Update existing
        await updateActivity(editingActivity.id, {
          name: activityName.trim(),
          color: selectedColor,
          icon: selectedIcon,
        });
      } else {
        // Add new
        await addActivity({
          name: activityName.trim(),
          color: selectedColor,
          icon: selectedIcon,
          points: 5,
          order: activities.length,
        });
      }

      setDialogVisible(false);
      setActivityName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to save activity');
    }
  };

  const handleDelete = (activity: Activity) => {
    Alert.alert('Delete Activity', `Are you sure you want to delete "${activity.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActivity(activity.id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete activity');
          }
        },
      },
    ]);
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <List.Item
      title={item.name}
      left={(props) => <List.Icon {...props} icon={item.icon} color={item.color} />}
      right={(props) => (
        <View style={styles.actionsContainer}>
          <IconButton icon="pencil" size={20} onPress={() => openEditDialog(item)} />
          <IconButton icon="delete" size={20} onPress={() => handleDelete(item)} />
        </View>
      )}
      style={styles.listItem}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.title}>
          Manage Activities
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Add, edit, or remove activities
        </Text>
      </View>

      <FlatList
        data={activities.sort((a, b) => a.order - b.order)}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge">No activities yet</Text>
            <Text variant="bodyMedium" style={styles.emptyText}>
              Tap the + button to add your first activity
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openAddDialog}
        label="Add Activity"
      />

      {/* Add/Edit Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>{editingActivity ? 'Edit Activity' : 'Add Activity'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Activity Name"
              value={activityName}
              onChangeText={setActivityName}
              mode="outlined"
              style={styles.input}
            />

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Color
            </Text>
            <View style={styles.colorGrid}>
              {AVAILABLE_COLORS.map((color) => (
                <IconButton
                  key={color}
                  icon={selectedColor === color ? 'check-circle' : 'circle'}
                  iconColor={color}
                  size={32}
                  onPress={() => setSelectedColor(color)}
                  style={selectedColor === color ? styles.selectedColor : undefined}
                />
              ))}
            </View>

            <Text variant="labelLarge" style={styles.sectionLabel}>
              Icon
            </Text>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((icon) => (
                <IconButton
                  key={icon}
                  icon={icon}
                  iconColor={selectedIcon === icon ? selectedColor : '#666'}
                  size={28}
                  onPress={() => setSelectedIcon(icon)}
                  style={selectedIcon === icon ? styles.selectedIcon : undefined}
                />
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    color: '#666',
  },
  list: {
    flexGrow: 1,
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 64,
  },
  emptyText: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  selectedColor: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxHeight: 200,
  },
  selectedIcon: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
});
