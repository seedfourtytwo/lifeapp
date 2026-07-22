import { StyleSheet } from 'react-native';

export const habitWidgetStyles = StyleSheet.create({
  card: {
    marginBottom: 6,
  },
  cardContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    paddingRight: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerTitle: {
    flex: 1,
    minWidth: 0,
  },
  timerTotalCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  name: {
    fontWeight: '700',
    flexShrink: 1,
  },
  titleLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  description: {
    marginTop: 2,
    opacity: 0.6,
  },
  timerTotal: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  resetButton: {
    margin: 0,
    marginRight: -8,
    width: 32,
    height: 32,
  },
  resetButtonHidden: {
    opacity: 0,
  },
  timerButton: {
    flex: 1,
    marginTop: 0,
  },
  timerButtonContent: {
    paddingVertical: 4,
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finishButton: {
    marginTop: 0,
  },
  progressBar: {
    marginTop: 0,
  },
});
