import { applyAppLanguage } from '../src/i18n';
import { formatLampLabel, formatRideLeft, formatTimeClear } from '../src/utils/commitmentFormat';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('time clear', () => {
  beforeAll(async () => {
    await applyAppLanguage('en');
  });

  it('shows minutes under an hour', () => {
    expect(formatTimeClear(0)).toBe('0m');
    expect(formatTimeClear(42 * MINUTE + 59_999)).toBe('42m');
    expect(formatTimeClear(HOUR - 1)).toBe('59m');
  });

  it('shows hours and minutes from one hour to a day', () => {
    expect(formatTimeClear(HOUR)).toBe('1h 0m');
    expect(formatTimeClear(5 * HOUR + 12 * MINUTE)).toBe('5h 12m');
    expect(formatTimeClear(DAY - 1)).toBe('23h 59m');
  });

  it('shows days and hours from one day on', () => {
    expect(formatTimeClear(DAY)).toBe('1d 0h');
    expect(formatTimeClear(2 * DAY + 14 * HOUR + 59 * MINUTE)).toBe('2d 14h');
    expect(formatTimeClear(40 * DAY)).toBe('40d 0h');
  });

  it('never runs below zero when the clock reads before clear-since', () => {
    expect(formatTimeClear(-5 * HOUR)).toBe('0m');
  });

  it('names lamps in hours, then in days', () => {
    expect([24, 48, 72, 120, 336, 504].map(formatLampLabel)).toEqual(['24h', '48h', '3d', '5d', '14d', '21d']);
  });

  it('speaks French when the app does', async () => {
    await applyAppLanguage('fr');
    expect(formatTimeClear(2 * DAY + 14 * HOUR)).toBe('2 j 14 h');
    expect(formatLampLabel(120)).toBe('5 j');
    await applyAppLanguage('en');
  });
});

describe('formatRideLeft', () => {
  it.each([
    [600, '10:00'],
    [522, '08:42'],
    [0.2, '00:01'],
    [0, '00:00'],
    [-5, '00:00'],
    [3600, '60:00'],
  ])('%s seconds read %s', (seconds, expected) => {
    expect(formatRideLeft(seconds)).toBe(expected);
  });
});
