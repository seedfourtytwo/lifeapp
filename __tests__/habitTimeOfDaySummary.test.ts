/**
 * The closed "Time of day" row in the habit editor says everything that is set
 * inside it, so the section does not have to be opened to check.
 */
import '../src/i18n';
import { i18n } from '../src/i18n';
import { timeOfDaySummary } from '../src/components/trackerEditor/habitSummaries';

const t = i18n.getFixedT('en', 'trackers');

const base = {
  useTimeRange: true,
  timeRangeStart: '07:00',
  timeRangeEnd: '09:00',
  visibleOnlyInTimeRange: false,
  useReminder: false,
  remindMinutesBefore: '15',
};

describe('timeOfDaySummary', () => {
  it('says any time when no range is in use', () => {
    expect(timeOfDaySummary({ ...base, useTimeRange: false }, t)).toBe('Any time');
  });

  it('says any time while the range is still half typed', () => {
    expect(timeOfDaySummary({ ...base, timeRangeEnd: '' }, t)).toBe('Any time');
    expect(timeOfDaySummary({ ...base, timeRangeStart: '7' }, t)).toBe('Any time');
  });

  it('shows the range on its own', () => {
    expect(timeOfDaySummary(base, t)).toBe('07:00–09:00');
  });

  it('adds the reminder and how long before', () => {
    expect(timeOfDaySummary({ ...base, useReminder: true, remindMinutesBefore: '10' }, t)).toBe(
      '07:00–09:00, reminder 10 min before',
    );
  });

  it('words a zero-minute reminder as one at the start', () => {
    expect(timeOfDaySummary({ ...base, useReminder: true, remindMinutesBefore: '0' }, t)).toBe(
      '07:00–09:00, reminder at the start',
    );
  });

  it('leaves out a reminder whose minutes cannot be read', () => {
    expect(timeOfDaySummary({ ...base, useReminder: true, remindMinutesBefore: '' }, t)).toBe(
      '07:00–09:00',
    );
    expect(timeOfDaySummary({ ...base, useReminder: true, remindMinutesBefore: '-5' }, t)).toBe(
      '07:00–09:00',
    );
  });

  it('says when the habit is hidden outside the range', () => {
    expect(
      timeOfDaySummary(
        { ...base, visibleOnlyInTimeRange: true, useReminder: true, remindMinutesBefore: '10' },
        t,
      ),
    ).toBe('07:00–09:00, hidden outside it, reminder 10 min before');
  });
});
