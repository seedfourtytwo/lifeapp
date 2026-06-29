import { parseSoundLibrary, SoundAssetSchema } from '../src/protocol/sound';

describe('parseSoundLibrary', () => {
  it('parses an array of sound assets', () => {
    const sounds = parseSoundLibrary([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        label: 'Morning meditation',
        source: 'file',
        uri: 'file:///data/sounds/track.mp3',
      },
    ]);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].label).toBe('Morning meditation');
  });

  it('rejects invalid entries', () => {
    expect(() => parseSoundLibrary([{ id: 'bad', label: '', source: 'file', uri: '' }])).toThrow();
  });
});

describe('SoundAssetSchema', () => {
  it('allows youtube source for forward compatibility', () => {
    const asset = SoundAssetSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440001',
      label: 'Ambient',
      source: 'youtube',
      uri: 'https://www.youtube.com/watch?v=example',
    });
    expect(asset.source).toBe('youtube');
  });
});
