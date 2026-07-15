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
    expect(bundle.elements[0].archivedAt).toBeNull();
  });

  it('treats legacy empty-dashboard bundles as all active', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          kind: 'counter',
          name: 'Water',
          config: { quickIncrements: [1], unit: 'glass' },
          protocolVersion: PROTOCOL_VERSION,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      dashboard: [],
      events: [],
    });

    const bundle = parseProtocolBundle(normalized);
    expect(bundle.elements[0].archivedAt).toBeNull();
  });

  it('keeps modern empty-dashboard backups archived when archivedAt is set', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          kind: 'counter',
          name: 'Water',
          config: { quickIncrements: [1], unit: 'glass' },
          protocolVersion: PROTOCOL_VERSION,
          createdAt: '2025-01-01T00:00:00.000Z',
          archivedAt: '2025-01-02T00:00:00.000Z',
        },
      ],
      dashboard: [],
      events: [],
    });

    const bundle = parseProtocolBundle(normalized);
    expect(bundle.elements[0].archivedAt).toBe('2025-01-02T00:00:00.000Z');
  });

  it('marks dashboard members active and others archived for legacy pin exports', () => {
    const normalized = normalizeProtocolBundleInput({
      protocolVersion: PROTOCOL_VERSION,
      exportedAt: '2025-01-01T00:00:00.000Z',
      elements: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          kind: 'counter',
          name: 'Active',
          config: { quickIncrements: [1], unit: 'glass' },
          protocolVersion: PROTOCOL_VERSION,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          kind: 'counter',
          name: 'Unpinned',
          config: { quickIncrements: [1], unit: 'glass' },
          protocolVersion: PROTOCOL_VERSION,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      dashboard: [
        {
          id: '550e8400-e29b-41d4-a716-446655440020',
          elementId: '550e8400-e29b-41d4-a716-446655440010',
          sortOrder: 0,
        },
      ],
      events: [],
    });

    const bundle = parseProtocolBundle(normalized);
    expect(bundle.elements[0].archivedAt).toBeNull();
    expect(bundle.elements[1].archivedAt).toBe('2025-01-01T00:00:00.000Z');
  });
});
