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
