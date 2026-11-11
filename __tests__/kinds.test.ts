/* eslint-disable import/first -- mock must load before registry pulls in widgets */
jest.mock('../src/hooks/useAppTheme', () => ({
  useAppTheme: () => ({
    themeMode: 'light',
    decorations: {
      borderWidth: 1.5,
      radius: { sm: 8, md: 14, lg: 20 },
      tabRadius: 14,
      progressHeight: 4,
      buttonRadius: 999,
    },
  }),
}));

import { counterHandler } from '../src/kinds/registry';
import { habitHandler } from '../src/kinds/habit/handler';

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
