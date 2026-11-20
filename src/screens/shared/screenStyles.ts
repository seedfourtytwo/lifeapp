import { StyleSheet } from 'react-native';
import { layout, space } from '../../theme/spacing';

/** Shared layout for the Home pages. */
export const homeTabScreenStyles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Layout only — colour comes from QuietText, never from opacity. */
  empty: {
    textAlign: 'center',
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
  },
  errorBox: {
    marginBottom: space.lg,
    gap: space.sm,
  },
  error: {
    marginBottom: space.sm,
  },
});
