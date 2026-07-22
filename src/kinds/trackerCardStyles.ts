import { StyleSheet } from 'react-native';

/**
 * Shared Home tracker card layout (tick-off, timer, counter).
 * Owned by TrackerCard + kind widgets — do not fork per kind.
 */
export const trackerCardStyles = StyleSheet.create({
  card: {
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titlePress: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    fontWeight: '600',
    flexShrink: 1,
  },
  subline: {
    fontWeight: '500',
  },
  metaCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '48%',
    gap: 0,
    paddingTop: 1,
  },
  metaText: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  iconButton: {
    margin: 0,
    width: 32,
    height: 32,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    margin: 0,
  },
  primaryButtonContent: {
    minHeight: 44,
    paddingVertical: 4,
  },
  primaryButtonLabel: {
    fontWeight: '700',
    marginVertical: 0,
  },
  finishButton: {
    margin: 0,
    justifyContent: 'center',
  },
  progressBar: {
    borderRadius: 999,
    overflow: 'hidden',
  },
});
