/**
 * IntervalTimer Component
 * Simple countdown timer with rounds and intervals support
 * Includes sound and vibration alerts
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Vibration } from 'react-native';
import { Text, Button, Card, TextInput, IconButton } from 'react-native-paper';
import { Audio } from 'expo-av';

export default function IntervalTimer() {
  const [minutes, setMinutes] = useState('1');
  const [seconds, setSeconds] = useState('0');
  const [rounds, setRounds] = useState('1');
  const [restMinutes, setRestMinutes] = useState('0');
  const [restSeconds, setRestSeconds] = useState('30');

  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Load sound on mount
    loadSound();
    return () => {
      // Cleanup
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && remainingTime === 0) {
      handleTimerComplete();
    }

    return () => clearInterval(interval);
  }, [isRunning, remainingTime]);

  const loadSound = async () => {
    try {
      // Note: You can add a custom sound file at assets/timer-complete.mp3
      // For now, we'll just use vibration
      // const { sound } = await Audio.Sound.createAsync(
      //   require('../../assets/timer-complete.mp3'),
      //   { shouldPlay: false }
      // );
      // soundRef.current = sound;
    } catch (error) {
      console.log('Could not load sound:', error);
    }
  };

  const playAlert = async () => {
    try {
      // Vibrate
      Vibration.vibrate([0, 500, 200, 500]);

      // Play sound
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (error) {
      console.log('Error playing alert:', error);
    }
  };

  const handleTimerComplete = async () => {
    await playAlert();

    if (isResting) {
      // Rest complete, move to next round
      if (currentRound < parseInt(rounds)) {
        setCurrentRound((prev) => prev + 1);
        setIsResting(false);
        setRemainingTime(parseInt(minutes) * 60 + parseInt(seconds));
      } else {
        // All rounds complete
        handleStop();
      }
    } else {
      // Work interval complete
      if (currentRound < parseInt(rounds) && (parseInt(restMinutes) > 0 || parseInt(restSeconds) > 0)) {
        // Start rest interval
        setIsResting(true);
        setRemainingTime(parseInt(restMinutes) * 60 + parseInt(restSeconds));
      } else if (currentRound < parseInt(rounds)) {
        // No rest, move to next round
        setCurrentRound((prev) => prev + 1);
        setRemainingTime(parseInt(minutes) * 60 + parseInt(seconds));
      } else {
        // All rounds complete
        handleStop();
      }
    }
  };

  const handleStart = () => {
    const totalSeconds = parseInt(minutes) * 60 + parseInt(seconds);
    if (totalSeconds > 0) {
      setRemainingTime(totalSeconds);
      setCurrentRound(1);
      setIsResting(false);
      setIsRunning(true);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    setCurrentRound(1);
    setIsResting(false);
    setRemainingTime(0);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
  };

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasRest = parseInt(restMinutes) > 0 || parseInt(restSeconds) > 0;

  return (
    <Card style={styles.card}>
      <Card.Content>
        {!isRunning && remainingTime === 0 ? (
          <>
            <Text variant="titleMedium" style={styles.label}>
              Timer Setup
            </Text>

            {/* Work Duration */}
            <View style={styles.row}>
              <Text style={styles.inputLabel}>Work:</Text>
              <TextInput
                mode="outlined"
                value={minutes}
                onChangeText={(val) => setMinutes(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={styles.timeInput}
                dense
                label="Min"
              />
              <TextInput
                mode="outlined"
                value={seconds}
                onChangeText={(val) => setSeconds(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={styles.timeInput}
                dense
                label="Sec"
              />
            </View>

            {/* Rest Duration */}
            <View style={styles.row}>
              <Text style={styles.inputLabel}>Rest:</Text>
              <TextInput
                mode="outlined"
                value={restMinutes}
                onChangeText={(val) => setRestMinutes(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={styles.timeInput}
                dense
                label="Min"
              />
              <TextInput
                mode="outlined"
                value={restSeconds}
                onChangeText={(val) => setRestSeconds(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                style={styles.timeInput}
                dense
                label="Sec"
              />
            </View>

            {/* Rounds */}
            <View style={styles.row}>
              <Text style={styles.inputLabel}>Rounds:</Text>
              <TextInput
                mode="outlined"
                value={rounds}
                onChangeText={(val) => setRounds(val.replace(/[^0-9]/g, '') || '1')}
                keyboardType="number-pad"
                style={styles.roundsInput}
                dense
              />
            </View>

            <Button
              mode="contained"
              onPress={handleStart}
              style={styles.button}
              buttonColor="#4CAF50"
              icon="play"
            >
              Start Timer
            </Button>
          </>
        ) : (
          <>
            <Text variant="titleMedium" style={styles.label}>
              {isResting ? 'Rest' : 'Work'}
            </Text>

            <Text variant="displayLarge" style={[styles.timer, isResting && styles.restTimer]}>
              {formatTime(remainingTime)}
            </Text>

            {parseInt(rounds) > 1 && (
              <Text variant="titleMedium" style={styles.roundInfo}>
                Round {currentRound} / {rounds}
              </Text>
            )}

            <View style={styles.buttonRow}>
              {isRunning ? (
                <Button
                  mode="contained"
                  onPress={handlePause}
                  style={styles.actionButton}
                  buttonColor="#FF9800"
                  icon="pause"
                >
                  Pause
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={handleResume}
                  style={styles.actionButton}
                  buttonColor="#4CAF50"
                  icon="play"
                >
                  Resume
                </Button>
              )}
              <Button
                mode="outlined"
                onPress={handleStop}
                style={styles.actionButton}
                textColor="#F44336"
                icon="stop"
              >
                Stop
              </Button>
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
  },
  label: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  inputLabel: {
    width: 60,
    fontSize: 16,
  },
  timeInput: {
    flex: 1,
    maxWidth: 80,
  },
  roundsInput: {
    flex: 1,
    maxWidth: 80,
  },
  button: {
    marginTop: 16,
  },
  timer: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 16,
  },
  restTimer: {
    color: '#FF9800',
  },
  roundInfo: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
});
