import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { typeScale } from '../theme/typography';

/**
 * One header for every stack screen: the page's own ground, no shadow line,
 * the title in the display face. It reads as the top of the page rather than
 * a bar laid over it.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useTheme();

  return {
    headerStyle: { backgroundColor: theme.colors.background },
    headerShadowVisible: false,
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontFamily: typeScale.screenTitle.fontFamily,
      fontSize: typeScale.screenTitle.fontSize,
      color: theme.colors.onSurface,
    },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
