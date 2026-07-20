import {
  bumpWriteEpoch,
  captureWriteEpochs,
  mergeUnchangedEntries,
  resetWriteEpochsForTests,
} from '../src/store/writeEpoch';

describe('writeEpoch merge', () => {
  beforeEach(() => {
    resetWriteEpochsForTests();
  });

  it('keeps loaded values when no write happened', () => {
    const captured = captureWriteEpochs(['a', 'b']);
    expect(mergeUnchangedEntries({ a: 1, b: 2 }, captured)).toEqual({ a: 1, b: 2 });
  });

  it('drops entries mutated after capture', () => {
    const captured = captureWriteEpochs(['a', 'b']);
    bumpWriteEpoch('a');
    expect(mergeUnchangedEntries({ a: 1, b: 2 }, captured)).toEqual({ b: 2 });
  });
});
