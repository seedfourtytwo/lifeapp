import { StyleSheet } from 'react-native';
import { space } from '../../theme/spacing';

/** Shared layout for the Home tabs (Habits, Counters, Nutrition, Todos). */
export const homeTabScreenStyles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
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
  /** A tracker outside its time window: inactive, not merely secondary. */
  dimmedCard: {
    opacity: 0.62,
  },
});
