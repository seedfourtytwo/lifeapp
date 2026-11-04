import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { useAppTheme } from '../hooks/useAppTheme';
import { typeScale } from '../theme/typography';

/**
 * One header for every stack screen: the page's own ground, no shadow line,
 * the title in the display face. It reads as the top of the page rather than
 * a bar laid over it. Cartoon keeps its drawn edge, as its cards do.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useTheme();
  const { isCartoon } = useAppTheme();

  return {
    headerStyle: { backgroundColor: theme.colors.background },
    // Native-stack headers take only a background colour, so cartoon's edge is
    // the platform's own header line rather than a drawn border.
    headerShadowVisible: isCartoon,
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontFamily: typeScale.screenTitle.fontFamily,
      fontSize: typeScale.screenTitle.fontSize,
      color: theme.colors.onSurface,
    },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}
