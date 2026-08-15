import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';

/** Shared native-stack header/content chrome for root and nested stacks. */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useTheme();
  const { decorations: deco, isCartoon } = useAppTheme();

  return {
    headerStyle: {
      backgroundColor: theme.colors.surface,
      ...(isCartoon
        ? {
            borderBottomWidth: deco.headerBorderWidth,
            borderBottomColor: theme.colors.outline,
          }
        : {}),
    },
    headerTintColor: theme.colors.primary,
    headerTitleStyle: {
      fontWeight: 'bold',
      color: theme.colors.onSurface,
    },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
