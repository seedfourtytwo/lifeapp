/* eslint-disable import/first -- mock must load before registry pulls in widgets */
jest.mock('../src/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeMode: 'light',
    decorations: {
      borderWidth: 1,
      cardBorderWidth: 1,
      radius: { sm: 8, md: 12, lg: 16 },
      tabRadius: 12,
      progressHeight: 3,
      buttonRadius: 8,
      headerBorderWidth: 1,
    },
    isCartoon: false,
  }),
}));

import { counterHandler } from '../src/kinds/registry';
import { habitHandler, habitEventsComplete } from '../src/kinds/habit/handler';
import { HabitConfigSchema } from '../src/protocol';

describe('counterHandler', () => {
  it('sums event values for daily total', () => {
    const total = counterHandler.aggregateDaily([
      {
        id: '1',
        elementId: 'e1',
        timestamp: '2025-01-01T10:00:00.000Z',
        date: '2025-01-01',
        value: 5,
        protocolVersion: 1,
      },
      {
        id: '2',
        elementId: 'e1',
        timestamp: '2025-01-01T11:00:00.000Z',
        date: '2025-01-01',
        value: 10,
        protocolVersion: 1,
      },
    ]);

    expect(total).toBe(15);
  });
});

describe('habitHandler', () => {
  const config = HabitConfigSchema.parse({ timeSlot: 'anytime' });

  it('treats boolean completion as value >= 1', () => {
    const complete = habitEventsComplete(
      [
        {
          id: '1',
          elementId: 'e1',
          timestamp: '2025-01-01T10:00:00.000Z',
          date: '2025-01-01',
          value: 1,
          protocolVersion: 1,
        },
      ],
      config,
    );
    expect(complete).toBe(true);
  });

  it('aggregates timer seconds for the day', () => {
    const total = habitHandler.aggregateDaily([
      {
        id: '1',
        elementId: 'e1',
        timestamp: '2025-01-01T10:00:00.000Z',
        date: '2025-01-01',
        value: 300,
        protocolVersion: 1,
      },
      {
        id: '2',
        elementId: 'e1',
        timestamp: '2025-01-01T18:00:00.000Z',
        date: '2025-01-01',
        value: 600,
        protocolVersion: 1,
      },
    ]);
    expect(total).toBe(900);
  });
});
