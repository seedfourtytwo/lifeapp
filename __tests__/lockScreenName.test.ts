import { buildHabitConfig, HabitConfigSchema, LOCK_SCREEN_NAME_MAX } from '../src/protocol';
import { editorSessionFromHabit } from '../src/components/trackerEditor/trackerEditorSession';

/**
 * A short, neutral name a habit can show on a locked phone instead of its
 * real one. Stored trimmed and short; a stored name that is too long is cut
 * rather than making the whole habit unreadable.
 */
describe('lockScreenName', () => {
  it('is stored trimmed', () => {
    expect(buildHabitConfig({ lockScreenName: '  Evening  ' }).lockScreenName).toBe('Evening');
  });

  it('is left out when empty', () => {
    expect(buildHabitConfig({ lockScreenName: '   ' })).not.toHaveProperty('lockScreenName');
    expect(HabitConfigSchema.parse({ lockScreenName: ' ' }).lockScreenName).toBeUndefined();
  });

  it(`keeps at most ${LOCK_SCREEN_NAME_MAX} characters`, () => {
    const long = 'x'.repeat(LOCK_SCREEN_NAME_MAX + 5);
    expect(buildHabitConfig({ lockScreenName: long }).lockScreenName).toHaveLength(LOCK_SCREEN_NAME_MAX);
    expect(HabitConfigSchema.parse({ lockScreenName: long }).lockScreenName).toHaveLength(
      LOCK_SCREEN_NAME_MAX,
    );
  });

  it('comes back into the editor', () => {
    const config = buildHabitConfig({ lockScreenName: 'Evening' });
    expect(editorSessionFromHabit('id', 'Kefir', config).lockScreenName).toBe('Evening');
  });
});
