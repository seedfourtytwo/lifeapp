import { StyleSheet } from 'react-native';

/** Shared layout styles for Daily and Counter home tabs. */
export const pinnedTabScreenStyles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 48,
    paddingHorizontal: 24,
  },
  errorBox: {
    marginBottom: 16,
    gap: 8,
  },
  error: {
    marginBottom: 8,
  },
});
