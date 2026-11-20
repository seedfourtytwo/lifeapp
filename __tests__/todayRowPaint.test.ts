/**
 * The Today rows wear the lock-screen widget's colours: one per kind of row.
 * Which kind a row is, and which part of its figure reads bright, are decided
 * here rather than in each component.
 */
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { ROW_KIND_GLYPHS, rowKindColour } from '../src/kinds/rowKind';
import { splitRowFigure } from '../src/kinds/rowFigure';

describe('rowKindColour', () => {
  it('paints a timed habit as a timer', () => {
    expect(rowKindColour({ kind: 'habit', trackingMode: 'timer' })).toBe('timer');
  });

  it('paints a tick-off habit as a tick', () => {
    expect(rowKindColour({ kind: 'habit', trackingMode: 'boolean' })).toBe('tick');
  });

  it('paints a counter as a counter', () => {
    expect(rowKindColour({ kind: 'counter' })).toBe('counter');
  });

  it('paints a todo as a todo', () => {
    expect(rowKindColour({ kind: 'todo' })).toBe('todo');
  });
});

describe('ROW_KIND_GLYPHS', () => {
  it.each(Object.entries(ROW_KIND_GLYPHS))('%s falls back to a real glyph, %s', (_kind, glyph) => {
    expect(Object.prototype.hasOwnProperty.call(glyphMap, glyph)).toBe(true);
  });
});

describe('splitRowFigure', () => {
  it('splits a timer at the slash: what is done, then the slash and the goal', () => {
    expect(splitRowFigure('24:10 / 1:00:00')).toEqual({ done: '24:10', rest: ' / 1:00:00' });
  });

  it('splits a count the same way', () => {
    expect(splitRowFigure('40 / 100')).toEqual({ done: '40', rest: ' / 100' });
  });

  it('keeps a zero on the bright side: nothing done yet is still the done part', () => {
    expect(splitRowFigure('0 / 8')).toEqual({ done: '0', rest: ' / 8' });
  });

  it('leaves a lone figure whole and quiet', () => {
    expect(splitRowFigure('15:00')).toEqual({ done: null, rest: '15:00' });
    expect(splitRowFigure('7')).toEqual({ done: null, rest: '7' });
  });

  it('splits only at the first slash', () => {
    expect(splitRowFigure('1 / 2 / 3')).toEqual({ done: '1', rest: ' / 2 / 3' });
  });
});
