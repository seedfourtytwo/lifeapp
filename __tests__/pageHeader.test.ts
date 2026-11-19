/**
 * The header of a Home page that is not a day.
 *
 * Swiping between Today and the other pages must not move the title, so the
 * row is held to the day header's: the same floor, and a floor rather than a
 * fixed height, because the title is text and grows with the system font.
 */
import { StyleSheet, type ViewStyle } from 'react-native';
import { pageHeaderStyles } from '../src/screens/shared/PageHeader';

/** `titleRow.minHeight` in `src/screens/shared/DayHeader.tsx`. */
const DAY_HEADER_TITLE_ROW = 40;

describe('the page header row', () => {
  const row: ViewStyle = StyleSheet.flatten(pageHeaderStyles.row);

  it('has the day header title row as its floor', () => {
    expect(row.minHeight).toBe(DAY_HEADER_TITLE_ROW);
  });

  it('states no fixed height, so a large font can grow it', () => {
    expect(row.height).toBeUndefined();
  });
});
