import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { springOrSnap } from '../utils/motion';
import { trackerCardStyles as styles } from './trackerCardStyles';

/** Lets the row's title press the whole tile, not only the words. */
const TilePressContext = createContext<(pressed: boolean) => void>(() => {});

/** The tile a row sits on reports a press here, so it can give a little. */
export function useTilePress(): (pressed: boolean) => void {
  return useContext(TilePressContext);
}

const PRESSED_SCALE = 0.98;

/**
 * A Home row's tile: a surface on the stepped page, no outline, no shadow.
 * It shrinks a touch while its title is held, the way a real key gives.
 */
export default function TrackerCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { decorations: deco } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const setPressed = useCallback(
    (pressed: boolean) => {
      springOrSnap(
        scale,
        { toValue: pressed ? PRESSED_SCALE : 1, speed: 40, bounciness: 0, useNativeDriver: true },
        reduceMotion,
      ).start();
    },
    [reduceMotion, scale],
  );
  return (
    <TilePressContext.Provider value={setPressed}>
      <Animated.View
        style={[
          styles.card,
          {
            borderRadius: deco.radius.lg,
            backgroundColor: theme.colors.surface,
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TilePressContext.Provider>
  );
}
