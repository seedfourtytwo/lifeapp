/**
 * SettingsScreen
 * Organized settings with collapsible sections
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Alert, ScrollView } from 'react-native';
import { Text, List, FAB, IconButton, TextInput, Button, Dialog, Portal, Divider } from 'react-native-paper';
import { useActivityStore } from '../store/activityStore';
import { Activity, ActivityGoal } from '../types';
import GoalInput from '../components/GoalInput';
import * as storage from '../services/storageService';

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

  // Activity dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityName, setActivityName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);

  // Goals state
  const [goals, setGoals] = useState<ActivityGoal[]>([]);
  const [goalsExpanded, setGoalsExpanded] = useState(true);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);

  // Load goals on mount
  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const settings = await storage.getUserSettings();
    setGoals(settings.dailyGoals || []);
  };

  const saveGoals = async (updatedGoals: ActivityGoal[]) => {
    const settings = await storage.getUserSettings();
    settings.dailyGoals = updatedGoals;
    await storage.saveUserSettings(settings);
    setGoals(updatedGoals);
  };

  const handleGoalUpdate = (activity: Activity, enabled: boolean, minutes: number) => {
    const existingIndex = goals.findIndex((g) => g.activityId === activity.id);

    let updatedGoals: ActivityGoal[];
    if (existingIndex >= 0) {
      // Update existing goal
      updatedGoals = [...goals];
      updatedGoals[existingIndex] = {
        activityId: activity.id,
        activityName: activity.name,
        minimumMinutes: minutes,
        enabled,
      };
    } else {
      // Add new goal
      updatedGoals = [
        ...goals,
        {
          activityId: activity.id,
          activityName: activity.name,
          minimumMinutes: minutes,
          enabled,
        },
      ];
    }

    saveGoals(updatedGoals);
  };

  const getTotalGoalMinutes = () => {
    return goals
      .filter((g) => g.enabled)
      .reduce((sum, g) => sum + g.minimumMinutes, 0);
  };

  // Activity management functions
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
        await updateActivity(editingActivity.id, {
          name: activityName.trim(),
          color: selectedColor,
          icon: selectedIcon,
        });
      } else {
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

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Daily Goals Section */}
        <List.Accordion
          title="Daily Goals"
          description={goalsExpanded ? `${getTotalGoalMinutes()} minutes total` : undefined}
          left={(props) => <List.Icon {...props} icon="target" />}
          expanded={goalsExpanded}
          onPress={() => setGoalsExpanded(!goalsExpanded)}
          style={styles.accordion}
        >
          <View style={styles.sectionContent}>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Set minimum daily goals for each activity. Reach 80% to get a green day!
            </Text>
            {activities.sort((a, b) => a.order - b.order).map((activity) => {
              const goal = goals.find((g) => g.activityId === activity.id);
              return (
                <GoalInput
                  key={activity.id}
                  activity={activity}
                  goal={goal}
                  onUpdate={(enabled, minutes) => handleGoalUpdate(activity, enabled, minutes)}
                />
              );
            })}
          </View>
        </List.Accordion>

        <Divider />

        {/* Activities Section */}
        <List.Accordion
          title="Manage Activities"
          description={`${activities.length} activities`}
          left={(props) => <List.Icon {...props} icon="format-list-bulleted" />}
          expanded={activitiesExpanded}
          onPress={() => setActivitiesExpanded(!activitiesExpanded)}
          style={styles.accordion}
        >
          <View style={styles.sectionContent}>
            {activities.sort((a, b) => a.order - b.order).map((item) => (
              <List.Item
                key={item.id}
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
            ))}
            <Button
              mode="outlined"
              icon="plus"
              onPress={openAddDialog}
              style={styles.addButton}
            >
              Add Activity
            </Button>
          </View>
        </List.Accordion>

        <Divider />
      </ScrollView>

      {/* Add/Edit Activity Dialog */}
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
  accordion: {
    backgroundColor: '#FFFFFF',
  },
  sectionContent: {
    backgroundColor: '#FAFAFA',
    paddingBottom: 16,
  },
  sectionDescription: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 8,
  },
  addButton: {
    margin: 16,
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
