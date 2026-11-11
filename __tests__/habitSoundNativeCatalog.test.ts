import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUNDLED_HABIT_SOUND_CATALOG } from '../src/protocol/habitSoundCatalog';

/**
 * The tracks play natively, from the module's Android resources; the app's
 * catalog keeps their ids, labels and durations. The two lists must agree.
 */
const MODULE = path.join(__dirname, '../modules/life-core/android/src/main');
const kotlin = fs.readFileSync(path.join(MODULE, 'java/expo/modules/lifecore/HabitSounds.kt'), 'utf8');
const rawFiles = fs.readdirSync(path.join(MODULE, 'res/raw'));

function rawFileFor(resource: string): string | undefined {
  return rawFiles.find((file) => file.replace(/\.[^.]+$/, '') === resource);
}

const nativeTracks = [...kotlin.matchAll(/"([^"]+)" to R\.raw\.(\w+)/g)].map(([, id, resource]) => ({
  id: id!,
  resource: resource!,
}));

describe('the native sound list', () => {
  it('names exactly the tracks of the catalog', () => {
    expect(nativeTracks.map((track) => track.id).sort()).toEqual(
      BUNDLED_HABIT_SOUND_CATALOG.map((track) => track.id).sort(),
    );
  });

  it('points every track at a file in the module resources', () => {
    for (const { resource } of nativeTracks) {
      expect(rawFileFor(resource)).toBeDefined();
    }
  });

  it('has the silent keepalive and the chime too', () => {
    for (const resource of [...kotlin.matchAll(/: Int = R\.raw\.(\w+)/g)].map(([, name]) => name!)) {
      expect(rawFileFor(resource)).toBeDefined();
    }
    expect(kotlin).toMatch(/val keepalive: Int = R\.raw\.timer_keepalive/);
    expect(kotlin).toMatch(/val chime: Int = R\.raw\.habit_complete/);
  });
});
