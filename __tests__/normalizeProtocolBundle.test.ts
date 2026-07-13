import { normalizeProtocolBundleInput } from '../src/db/normalizeProtocolBundle';
import { parseProtocolBundle, PROTOCOL_VERSION } from '../src/protocol';

describe('normalizeProtocolBundleInput', () => {
  it('strips legacy category and sound library from bundles', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          kind: 'habit',
          name: 'Meditate',
          category: 'habit',
          parentId: null,
          config: {
            timeSlot: 'anytime',
            soundId: '550e8400-e29b-41d4-a716-446655440099',
          },
          protocolVersion: PROTOCOL_VERSION,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      dashboard: [],
      events: [],
      soundLibrary: [
        {
          id: '550e8400-e29b-41d4-a716-446655440099',
          label: 'Old local track',
          source: 'file',
          uri: 'file:///data/habit-sounds/old.mp3',
        },
      ],
    });

    const bundle = parseProtocolBundle(normalized);
    expect(bundle.elements).toHaveLength(1);
    expect(bundle.elements[0].config).toEqual({
      timeSlot: 'anytime',
    });
  });
});
