import { backupStatusLine } from '../src/backup/backupStatusLine';
import { TARGET_UNAVAILABLE } from '../src/backup/autoBackup';

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ALife';
const MORNING = '2026-11-11T07:00:00.000Z';
const NEXT_MORNING = '2026-11-12T07:00:00.000Z';

describe('the backup status line under "Your data"', () => {
  it('asks for a folder when none is chosen', () => {
    expect(backupStatusLine(null, undefined)).toEqual({ key: 'data.autoBackupNotSet' });
  });

  it('says when the first backup will happen once a folder is chosen', () => {
    expect(backupStatusLine(FOLDER, undefined)).toEqual({ key: 'data.autoBackupWaiting' });
  });

  it('shows the last backup time', () => {
    expect(backupStatusLine(FOLDER, { lastSuccessAt: MORNING, lastError: null })).toEqual({
      key: 'data.autoBackupLast',
      when: new Date(MORNING),
    });
  });

  it('shows the error when it is newer than the last backup', () => {
    expect(
      backupStatusLine(FOLDER, {
        lastSuccessAt: MORNING,
        lastError: { at: NEXT_MORNING, message: 'No space left on device' },
      }),
    ).toEqual({ key: 'data.autoBackupFailed', when: new Date(NEXT_MORNING), reason: 'No space left on device' });
  });

  it('says plainly when the folder can no longer be reached', () => {
    expect(
      backupStatusLine(FOLDER, { lastSuccessAt: null, lastError: { at: MORNING, message: TARGET_UNAVAILABLE } }),
    ).toEqual({ key: 'data.autoBackupFolderGone', when: new Date(MORNING) });
  });
});
