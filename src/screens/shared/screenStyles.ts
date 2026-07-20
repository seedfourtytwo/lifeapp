import { StyleSheet } from 'react-native';

/** Shared layout styles for Daily and Counter home tabs. */
export const homeTabScreenStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
    minHeight: 36,
  },
  metaStatus: {
    flex: 1,
    minWidth: 0,
    opacity: 0.85,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  reorderCard: {
    flex: 1,
    minWidth: 0,
  },
  dimmedCard: {
    opacity: 0.62,
  },
});
