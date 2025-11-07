/**
 * ActivityButton Component
 * Displays an activity in one of three states:
 * 1. Idle - Not running (square card, large icon + name)
 * 2. Running-Compact - Running but not expanded (taller card with timer + mini controls)
 * 3. Expanded - Running and expanded (2-column width with full controls)
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { Activity, ActiveSession } from '../types';

interface ActivityButtonProps {
  activity: Activity;
  onPress: () => void;
  activeSession?: ActiveSession; // If provided, activity is running
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onToggleExpand?: () => void;
}

export default function ActivityButton({
  activity,
  onPress,
  activeSession,
  onPause,
  onResume,
  onStop,
  onToggleExpand,
}: ActivityButtonProps) {
  const isNegative = activity.isNegative || false;
  const isRunning = !!activeSession;
  const isExpanded = activeSession?.isExpanded || false;
  const isPaused = activeSession?.isPaused || false;

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // IDLE STATE - Not running
  if (!isRunning) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          styles.idleContainer,
          { backgroundColor: activity.color },
          isNegative && styles.negativeContainer,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`${activity.name} activity button${isNegative ? ' (negative)' : ''}`}
        accessibilityRole="button"
      >
        <View style={styles.idleContent}>
          <Icon name={activity.icon as keyof typeof Icon.glyphMap} size={32} color="#FFFFFF" />
          <Text style={styles.idleText} numberOfLines={2}>
            {activity.name}
          </Text>
          {isNegative && (
            <View style={styles.negativeIndicator}>
              <Icon name="alert-circle" size={16} color="#FFFFFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // EXPANDED STATE - Running + Expanded
  if (isExpanded) {
    return (
      <View
        style={[
          styles.container,
          styles.expandedContainer,
          { backgroundColor: activity.color },
        ]}
      >
        {/* Header with name and timer */}
        <View style={styles.expandedHeader}>
          <View style={styles.expandedTitleRow}>
            <Icon name={activity.icon as keyof typeof Icon.glyphMap} size={28} color="#FFFFFF" />
            <Text style={styles.expandedTitle}>{activity.name}</Text>
          </View>
          <Text style={[styles.expandedTimer, isPaused && styles.pausedTimer]}>
            {formatTime(activeSession.elapsedSeconds)}
          </Text>
          {isPaused && <Text style={styles.pausedLabel}>(Paused)</Text>}
        </View>

        {/* Primary Controls */}
        <View style={styles.expandedControls}>
          {isPaused ? (
            <IconButton
              icon="play"
              iconColor="#FFFFFF"
              containerColor="#4CAF50"
              size={24}
              onPress={onResume}
              style={styles.expandedButton}
            />
          ) : (
            <IconButton
              icon="pause"
              iconColor="#FFFFFF"
              containerColor="#FF9800"
              size={24}
              onPress={onPause}
              style={styles.expandedButton}
            />
          )}
          <IconButton
            icon="stop"
            iconColor="#FFFFFF"
            containerColor="#F44336"
            size={24}
            onPress={onStop}
            style={styles.expandedButton}
          />
        </View>

        {/* Activity-Specific Features Area */}
        <View style={styles.expandedFeatures}>
          <Text style={styles.expandedFeaturesPlaceholder}>
            Activity-specific features will appear here
          </Text>
        </View>

        {/* Collapse Button */}
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={onToggleExpand}
        >
          <Icon name="chevron-up" size={20} color="#FFFFFF" />
          <Text style={styles.collapseText}>Collapse</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // RUNNING-COMPACT STATE - Running but not expanded
  return (
    <TouchableOpacity
      style={[
        styles.container,
        styles.compactContainer,
        { backgroundColor: activity.color },
        styles.pulsingBorder, // Animated pulsing effect
      ]}
      onPress={onToggleExpand}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={`${activity.name} running, tap to expand`}
      accessibilityRole="button"
    >
      <View style={styles.compactContent}>
        {/* Top Section: Icon + Name + Timer */}
        <View style={styles.compactTop}>
          <Icon name={activity.icon as keyof typeof Icon.glyphMap} size={24} color="#FFFFFF" />
          <View style={styles.compactInfo}>
            <Text style={styles.compactName} numberOfLines={1}>
              {activity.name}
            </Text>
            <Text style={[styles.compactTimer, isPaused && styles.pausedTimer]}>
              {formatTime(activeSession.elapsedSeconds)}
              {isPaused && ' (Paused)'}
            </Text>
          </View>
        </View>

        {/* Bottom Section: Control Buttons */}
        <View style={styles.compactButtons}>
          {isPaused ? (
            <IconButton
              icon="play"
              iconColor="#FFFFFF"
              size={18}
              onPress={(e) => {
                e.stopPropagation();
                onResume?.();
              }}
              style={styles.miniButton}
            />
          ) : (
            <IconButton
              icon="pause"
              iconColor="#FFFFFF"
              size={18}
              onPress={(e) => {
                e.stopPropagation();
                onPause?.();
              }}
              style={styles.miniButton}
            />
          )}
          <IconButton
            icon="stop"
            iconColor="#FFFFFF"
            size={18}
            onPress={(e) => {
              e.stopPropagation();
              onStop?.();
            }}
            style={styles.miniButton}
          />
          <IconButton
            icon="dots-horizontal"
            iconColor="#FFFFFF"
            size={18}
            onPress={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            style={styles.miniButton}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    margin: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  // IDLE STATE STYLES
  idleContainer: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  negativeContainer: {
    borderWidth: 2,
    borderColor: '#FFF',
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  negativeIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 2,
  },

  // RUNNING-COMPACT STATE STYLES
  compactContainer: {
    flex: 1,
    aspectRatio: 0.77, // Taller than idle (1.3:1 ratio)
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pulsingBorder: {
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  compactContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactTimer: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  pausedTimer: {
    color: '#FF9800',
  },
  compactButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  miniButton: {
    margin: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // EXPANDED STATE STYLES
  expandedContainer: {
    width: '100%', // Will handle 2-column span in parent grid
    minHeight: 300,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  expandedHeader: {
    marginBottom: 16,
  },
  expandedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expandedTimer: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  pausedLabel: {
    fontSize: 14,
    color: '#FF9800',
    marginTop: 4,
  },
  expandedControls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  expandedButton: {
    flex: 1,
  },
  expandedFeatures: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 80,
  },
  expandedFeaturesPlaceholder: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  collapseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
