import {
  DAY_NOTE_BODY_MAX_LENGTH,
  DAILY_JOURNAL_BODY_MAX_LENGTH,
} from '../src/protocol';
import {
  NOTE_BODY_APPROACHING_REMAINING,
  NOTE_BODY_MAX_LENGTH,
  NOTE_BODY_URGENT_REMAINING,
} from '../src/notes/noteBodyLimits';

describe('note body limits', () => {
  it('keeps journal and day-note protocol maxes identical', () => {
    expect(DAILY_JOURNAL_BODY_MAX_LENGTH).toBe(DAY_NOTE_BODY_MAX_LENGTH);
    expect(NOTE_BODY_MAX_LENGTH).toBe(DAY_NOTE_BODY_MAX_LENGTH);
  });

  it('warns with remaining thresholds well below the hard max', () => {
    expect(NOTE_BODY_URGENT_REMAINING).toBeLessThan(NOTE_BODY_APPROACHING_REMAINING);
    expect(NOTE_BODY_APPROACHING_REMAINING).toBeLessThan(NOTE_BODY_MAX_LENGTH);
  });
});
