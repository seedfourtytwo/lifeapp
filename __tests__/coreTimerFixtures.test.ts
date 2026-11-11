import * as fs from 'node:fs';
import * as path from 'node:path';
import { CoreTimerStateSchema, TimerSessionRecordSchema } from '../src/protocol/coreTimer';

/** The same files `SharedFixturesTest.kt` reads: Kotlin and Zod agree on the JSON. */
function fixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../modules/life-core/fixtures', name), 'utf8'),
  );
}

describe('the JSON shared with the native core', () => {
  it('reads timer.json as Kotlin writes it', () => {
    const raw = fixture('timer-state.json');
    expect(CoreTimerStateSchema.parse(raw)).toEqual(raw);
  });

  it('reads a timer_session line as Kotlin writes it', () => {
    const raw = fixture('timer-session-line.json');
    expect(TimerSessionRecordSchema.parse(raw)).toEqual(raw);
  });
});
