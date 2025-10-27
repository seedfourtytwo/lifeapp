/**
 * EditDayDialog Component
 * Dialog for manually editing a day's tracking sessions
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Dialog, Portal, Text, Button, IconButton, Menu, TextInput, Divider } from 'react-native-paper';
import { Activity, TrackingSession } from '../types';
import * as storage from '../services/storageService';

interface EditDayDialogProps {
  visible: boolean;
  date: string;
  activities: Activity[];
  onDismiss: () => void;
  onSave: () => void;
}

interface SessionEdit {
  id: string;
  activityId: string;
  activityName: string;
  hours: string;
  minutes: string;
  isNew?: boolean;
}

export default function EditDayDialog({ visible, date, activities, onDismiss, onSave }: EditDayDialogProps) {
  const [sessions, setSessions] = useState<SessionEdit[]>([]);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible, date]);

  const loadSessions = async () => {
    const daySessions = await storage.getSessionsByDate(date);
    const edits: SessionEdit[] = daySessions.map((session) => {
      const activity = activities.find((a) => a.id === session.activityId);
      const totalMinutes = Math.round(session.durationSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return {
        id: session.id,
        activityId: session.activityId,
        activityName: activity?.name || 'Unknown',
        hours: hours.toString(),
        minutes: minutes.toString(),
      };
    });

    setSessions(edits);
  };

  const handleAddSession = () => {
    if (activities.length === 0) {
      Alert.alert('No Activities', 'Please add activities first in Settings');
      return;
    }

    const newSession: SessionEdit = {
      id: generateTempId(),
      activityId: activities[0].id,
      activityName: activities[0].name,
      hours: '0',
      minutes: '30',
      isNew: true,
    };

    setSessions([...sessions, newSession]);
  };

  const handleDeleteSession = async (sessionId: string, isNew: boolean) => {
    if (isNew) {
      // Just remove from local state
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } else {
      // Delete from storage
      Alert.alert('Delete Session', 'Are you sure you want to delete this session?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storage.deleteTrackingSession(sessionId);
            setSessions(sessions.filter((s) => s.id !== sessionId));
          },
        },
      ]);
    }
  };

  const handleChangeActivity = (sessionId: string, activityId: string) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;

    setSessions(
      sessions.map((s) =>
        s.id === sessionId
          ? { ...s, activityId, activityName: activity.name }
          : s
      )
    );
    setMenuVisible(null);
  };

  const handleTimeChange = (sessionId: string, field: 'hours' | 'minutes', value: string) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setSessions(
      sessions.map((s) =>
        s.id === sessionId ? { ...s, [field]: numValue } : s
      )
    );
  };

  const handleSave = async () => {
    try {
      for (const session of sessions) {
        const hours = parseInt(session.hours) || 0;
        const minutes = parseInt(session.minutes) || 0;
        const totalMinutes = hours * 60 + minutes;

        if (totalMinutes === 0) {
          continue; // Skip zero-duration sessions
        }

        const durationSeconds = totalMinutes * 60;

        if (session.isNew) {
          // Add new session
          const newSession: TrackingSession = {
            id: generateId(),
            activityId: session.activityId,
            startTime: new Date(`${date}T12:00:00`).toISOString(),
            endTime: new Date(`${date}T12:00:00`).toISOString(),
            durationSeconds,
            date,
            createdAt: new Date().toISOString(),
          };
          await storage.addTrackingSession(newSession);
        } else {
          // Update existing session
          await storage.updateTrackingSession(session.id, { durationSeconds });
        }
      }

      onSave();
      onDismiss();
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>Edit {new Date(date).toLocaleDateString()}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView style={styles.scrollView}>
            {sessions.length === 0 && (
              <Text style={styles.emptyText}>No sessions tracked. Tap + to add one.</Text>
            )}

            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <Menu
                  visible={menuVisible === session.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setMenuVisible(session.id)}
                      style={styles.activityButton}
                      compact
                    >
                      {session.activityName}
                    </Button>
                  }
                >
                  {activities.map((activity) => (
                    <Menu.Item
                      key={activity.id}
                      onPress={() => handleChangeActivity(session.id, activity.id)}
                      title={activity.name}
                      leadingIcon={activity.icon}
                    />
                  ))}
                </Menu>

                <View style={styles.timeInputs}>
                  <TextInput
                    mode="outlined"
                    value={session.hours}
                    onChangeText={(value) => handleTimeChange(session.id, 'hours', value)}
                    keyboardType="number-pad"
                    style={styles.timeInput}
                    dense
                    label="Hours"
                  />
                  <TextInput
                    mode="outlined"
                    value={session.minutes}
                    onChangeText={(value) => handleTimeChange(session.id, 'minutes', value)}
                    keyboardType="number-pad"
                    style={styles.timeInput}
                    dense
                    label="Min"
                  />
                </View>

                <IconButton
                  icon="delete"
                  size={20}
                  onPress={() => handleDeleteSession(session.id, session.isNew || false)}
                />
              </View>
            ))}

            <Button
              mode="outlined"
              icon="plus"
              onPress={handleAddSession}
              style={styles.addButton}
            >
              Add Session
            </Button>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const generateTempId = () => `temp_${Date.now()}_${Math.random()}`;

const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 24,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  activityButton: {
    flex: 1,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    width: 60,
  },
  addButton: {
    marginTop: 8,
    marginBottom: 16,
  },
});
