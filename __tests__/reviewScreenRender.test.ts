/**
 * Review's parts, rendered: the statement's figures are set heavier, every
 * tracker keeps a row before data lands, each row is one drawing with a
 * spoken summary, and the copy reads right in both languages.
 */
import React from 'react';
import { Animated } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import i18n from '../src/i18n';
import StrengthLine from '../src/components/history/StrengthLine';
import YearHeatmap from '../src/components/history/YearHeatmap';
import { shiftDateString, trackerDayHistory } from '../src/protocol';
import { yearHeatmap, type ReviewTrackerData } from '../src/review';
import ReviewLedger from '../src/screens/review/ReviewLedger';
import ReviewLegend from '../src/screens/review/ReviewLegend';
import ReviewStatement from '../src/screens/review/ReviewStatement';
import { reviewRow, type ReviewRow } from '../src/screens/review/reviewRows';
import { fontFamily } from '../src/theme/typography';

const TODAY = '2026-11-18';
const meditate: ReviewTrackerData = {
  tracker: {
    id: 'm',
    rules: {
      kind: 'habit',
      config: { trackingMode: 'boolean', timeSlot: 'anytime', schedule: { type: 'daily' } },
    },
    createdOn: '2025-01-01',
  },
  history: trackerDayHistory(
    [1, 2, 3, 4].map((o) => ({ date: shiftDateString(TODAY, -o), complete: true, hasSkipRow: false })),
  ),
};
const TRACKERS = [
  { id: 'm', name: 'Meditate' },
  { id: 'r', name: 'Read' },
];

const mounted: ReactTestRenderer[] = [];

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  mounted.push(tree);
  return tree;
}

afterEach(() => {
  act(() => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
});

/** All text under a node, in order. */
function textOf(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join('');
}

function ledger(range: 'week' | 'month' | 'year', rows: ReadonlyMap<string, ReviewRow>) {
  return render(
    React.createElement(ReviewLedger, {
      trackers: TRACKERS,
      rows,
      range,
      today: TODAY,
      estimatedWidth: 303,
      strengthWidth: 0,
      fade: new Animated.Value(1),
      onOpenTracker: () => undefined,
    }),
  );
}
const rowsFor = (range: 'week' | 'month' | 'year') =>
  new Map([['m', reviewRow({ data: meditate, name: 'Meditate' }, range, TODAY, 86)]]);

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('ReviewStatement', () => {
  it('sets the figure a weight heavier inside one sentence', () => {
    const tree = render(
      React.createElement(ReviewStatement, {
        statement: { key: 'statement.up.month', params: { percent: 78, previous: 71 } },
        footnote: [
          { key: 'footnote.slippedDays', params: { name: 'Stretch', done: 9, count: 21 } },
          { key: 'footnote.skippedLeftOut' },
        ],
        fade: new Animated.Value(1),
      }),
    );
    const text = textOf(tree.root);
    expect(text).toContain('You did 78% of what you planned, up from 71% the month before.');
    expect(text).toContain('Stretch slipped most: 9 of its 21 days. Skipped days are left out.');
    expect(text).not.toContain('<b>');
    const strong = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        ([node.props.style].flat(3) as ({ fontFamily?: string } | null | undefined)[]).some(
          (style) => style?.fontFamily === fontFamily.displayMedium,
        ),
    );
    expect(strong.map(textOf)).toEqual(['78%']);
  });
});

describe('ReviewLedger', () => {
  it('keeps a row for every tracker before any data has landed', () => {
    const tree = ledger('month', new Map());
    const rows = tree.root.findAll((node) => node.props.accessibilityRole === 'button' && typeof node.type === 'string');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['Meditate', 'Read']);
  });

  it('speaks a row as its summary and score, and shows the tally beside the score', () => {
    const tree = ledger('week', rowsFor('week'));
    const row = tree.root.find(
      (node) => typeof node.type === 'string' && String(node.props.accessibilityLabel ?? '').startsWith('Meditate:'),
    );
    expect(row.props.accessibilityLabel).toBe(
      'Meditate: 4 of 6 days done, 2 missed, 0 skipped. Strength 86 out of 100',
    );
    // A phone has no room for a strength column, and a bare score is not shown.
    expect(textOf(row)).toBe('Meditate4/6');
  });

  it('gives strength a labelled column of its own when there is room', () => {
    const tree = render(
      React.createElement(ReviewLedger, {
        trackers: TRACKERS,
        rows: rowsFor('week'),
        range: 'week',
        today: TODAY,
        estimatedWidth: 1008,
        strengthWidth: 80,
        fade: new Animated.Value(1),
        onOpenTracker: () => undefined,
      }),
    );
    const row = tree.root.find(
      (node) => typeof node.type === 'string' && String(node.props.accessibilityLabel ?? '').startsWith('Meditate:'),
    );
    expect(textOf(row)).toBe('Meditate4/686');
    expect(textOf(tree.root)).toContain('strength');
  });

  it.each([
    ['week', 7, 7],
    // A phone draws the last 28 days of the month: 27 past days and today.
    ['month', 4, 28],
    ['year', 12, 53],
  ] as const)('draws %s with at least %i labels and one drawing per row', (range, labels, marks) => {
    const tree = ledger(range, rowsFor(range));
    const svgs = tree.root.findAll((node) => (node.type as unknown) === 'RNSVGSvgView');
    expect(svgs).toHaveLength(TRACKERS.length);
    const drawn = svgs[0].findAll(
      (node) => (node.type as unknown) === 'RNSVGRect' || (node.type as unknown) === 'RNSVGPath',
    );
    // Created long ago and daily, so every column carries a mark.
    expect(drawn).toHaveLength(marks);
    expect(svgs[1].findAll((node) => (node.type as unknown) === 'RNSVGRect')).toHaveLength(0);
    const header = tree.root.find((node) => node.props.importantForAccessibility === 'no-hide-descendants' && typeof node.type === 'string');
    expect(textOf(header).length).toBeGreaterThanOrEqual(labels);
  });
});

describe('legend and history drawings', () => {
  it('names the three marks', () => {
    expect(textOf(render(React.createElement(ReviewLegend)).root)).toBe('donemissedskipped');
  });

  it('renders the heatmap and the strength line with a spoken summary', () => {
    const heatmap = render(
      React.createElement(YearHeatmap, { columns: yearHeatmap([], TODAY), accessibilityLabel: 'year' }),
    );
    expect(heatmap.root.findAll((node) => node.props.accessibilityLabel === 'year').length).toBeGreaterThan(0);
    const line = render(
      React.createElement(StrengthLine, { scores: [10, 20, 30], caption: 'Last 90 days', accessibilityLabel: 'line' }),
    );
    expect(textOf(line.root)).toContain('Last 90 days');
  });
});

describe('review copy', () => {
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('pluralises and reads plainly in English', () => {
    expect(i18n.t('review:footnote.slippedDays', { name: 'Run', done: 0, count: 1 })).toBe(
      'Run slipped most: 0 of its 1 day.',
    );
    expect(i18n.t('review:statement.nothing.year')).toBe('Nothing was planned this year.');
    expect(i18n.t('review:row.perDay', { value: '46' })).toBe('46 a day');
  });

  it('reads plainly in French', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('review:statement.down.month', { percent: 78, previous: 86 })).toBe(
      'Vous avez fait <b>78 %</b> de ce que vous aviez prévu, moins que les 86 % du mois précédent.',
    );
    expect(i18n.t('review:spoken.days', { name: 'Lire', done: 4, count: 6, missed: 2, skipped: 0 })).toBe(
      'Lire : 4 jours faits sur 6, 2 manqués, 0 sautés',
    );
  });
});
