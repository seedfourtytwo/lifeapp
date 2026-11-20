/**
 * Review's parts, rendered: the statement's figure takes the accent, the three
 * facts sit in tiles, the heat map draws one square a day in the theme's
 * shades behind a spoken summary, each list row opens its tracker, and the
 * copy reads right in both languages.
 */
import React from 'react';
import { PaperProvider } from 'react-native-paper';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import i18n from '../src/i18n';
import StrengthLine from '../src/components/history/StrengthLine';
import YearHeatmap from '../src/components/history/YearHeatmap';
import { dayTallies, reviewPeriod, yearHeatmap, type DayTally, type ReviewRange } from '../src/review';
import ReviewFacts from '../src/screens/review/ReviewFacts';
import ReviewHeatMap from '../src/screens/review/ReviewHeatMap';
import ReviewStandings from '../src/screens/review/ReviewStandings';
import ReviewStatement from '../src/screens/review/ReviewStatement';
import type { StandingRow } from '../src/screens/review/reviewRows';
import { getAppPalette } from '../src/theme/palette';
import { appLightTheme } from '../src/theme/themes';
import { fontFamily } from '../src/theme/typography';

/** A Wednesday. */
const TODAY = '2026-11-18';
const HEAT = getAppPalette('light').heat;

const mounted: ReactTestRenderer[] = [];

function render(element: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(React.createElement(PaperProvider, { theme: appLightTheme, children: element }));
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

type FlatStyle = Record<string, unknown>;
const styleOf = (node: ReactTestInstance): FlatStyle =>
  Object.assign({}, ...([node.props.style].flat(5).filter(Boolean) as FlatStyle[]));
const hostNodes = (tree: ReactTestRenderer, test: (node: ReactTestInstance) => boolean) =>
  tree.root.findAll((node) => typeof node.type === 'string' && test(node));

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('ReviewStatement', () => {
  it('paints the share done in the accent, inside one sentence', () => {
    const tree = render(
      React.createElement(ReviewStatement, {
        statement: { key: 'statement.up.month', params: { percent: 78, previous: 71 } },
      }),
    );
    expect(textOf(tree.root)).toBe('You did 78% of what you planned, up from 71% the month before.');
    const figure = hostNodes(tree, (node) => styleOf(node).fontFamily === fontFamily.displayMedium);
    expect(figure.map(textOf)).toEqual(['78%']);
    expect(styleOf(figure[0]).color).toBe(appLightTheme.colors.primary);
  });

  it('keeps its place while nothing has loaded', () => {
    const tree = render(React.createElement(ReviewStatement, { statement: null }));
    expect(textOf(tree.root)).toBe('');
    const sentence = hostNodes(tree, (node) => node.props.accessibilityRole === 'header')[0];
    expect(styleOf(sentence).minHeight).toEqual(expect.any(Number));
  });
});

describe('ReviewFacts', () => {
  const tiles = (tree: ReactTestRenderer) => hostNodes(tree, (node) => node.props.accessible === true);

  it('shows three figures in the mono face, each over its caption', () => {
    const tree = render(React.createElement(ReviewFacts, { facts: { fullDays: 6, run: 1, bestDay: 'Tue' } }));
    expect(tiles(tree).map(textOf)).toEqual(['6full days', '1day in a row now', 'Tueyour best day']);
    expect(tiles(tree).map((tile) => tile.props.accessibilityLabel)).toEqual([
      '6 full days',
      '1 day in a row now',
      'Tue your best day',
    ]);
    const figures = hostNodes(tree, (node) => styleOf(node).fontFamily === fontFamily.dataMedium);
    expect(figures.map(textOf)).toEqual(['6', '1', 'Tue']);
  });

  it('lets a caption wrap, and its tile grow, rather than clip', () => {
    const tree = render(React.createElement(ReviewFacts, { facts: { fullDays: 6, run: 4, bestDay: 'Tue' } }));
    for (const tile of tiles(tree)) {
      expect(styleOf(tile).height).toBeUndefined();
      const caption = tile.findAll((node) => (node.type as unknown) === 'Text').pop();
      expect(caption?.props.numberOfLines).toBeUndefined();
    }
  });

  it('shows a dash, and says why, when no weekday can be named', () => {
    const tree = render(React.createElement(ReviewFacts, { facts: { fullDays: 0, run: 0, bestDay: null } }));
    expect(textOf(tiles(tree)[2])).toBe('–your best day');
    expect(tiles(tree)[2].props.accessibilityLabel).toBe('Not enough days yet to name your best day');
  });

  it('holds its tiles with dashes before anything has loaded', () => {
    const tree = render(React.createElement(ReviewFacts, { facts: null }));
    expect(tiles(tree).map(textOf)).toEqual(['–full days', '–days in a row now', '–your best day']);
  });
});

/** The range's days, each given `[done, planned]` by `shareOf`; days after today plan nothing. */
function tallies(range: ReviewRange, shareOf: (date: string) => [number, number]): DayTally[] {
  return dayTallies([], reviewPeriod(range, TODAY).days, TODAY).map((day) => {
    if (day.date > TODAY) return day;
    const [done, planned] = shareOf(day.date);
    return { ...day, done, planned };
  });
}

function heatMap(range: ReviewRange, days: DayTally[]) {
  return render(
    React.createElement(ReviewHeatMap, {
      range,
      days,
      today: TODAY,
      estimatedWidth: 296,
      accessibilityLabel: 'summary',
    }),
  );
}

describe('ReviewHeatMap', () => {
  const dayCells = (tree: ReactTestRenderer) => hostNodes(tree, (node) => node.props.testID === 'heat-day');

  it('is one spoken element however many squares it draws', () => {
    for (const range of ['week', 'month', 'year'] as const) {
      const tree = heatMap(range, tallies(range, () => [1, 2]));
      const spoken = hostNodes(tree, (node) => node.props.accessible === true);
      expect(spoken.map((node) => node.props.accessibilityLabel)).toEqual(['summary']);
    }
  });

  it('draws a month as a calendar: initials, then one numbered square a day', () => {
    const tree = heatMap('month', tallies('month', () => [1, 2]));
    expect(textOf(tree.root).startsWith('MTWTFSS1234')).toBe(true);
    const cells = dayCells(tree);
    expect(cells.map(textOf)).toEqual(Array.from({ length: 30 }, (_, index) => String(index + 1)));
    expect(cells.every((cell) => styleOf(cell).aspectRatio === 1)).toBe(true);
  });

  it('shades a day by the share of its plan that was done', () => {
    const shares: Record<string, [number, number]> = {
      '2026-11-02': [0, 4],
      '2026-11-03': [1, 4],
      '2026-11-04': [2, 4],
      '2026-11-05': [3, 4],
      '2026-11-06': [4, 4],
    };
    const cells = dayCells(heatMap('month', tallies('month', (date) => shares[date] ?? [0, 0])));
    expect(cells.slice(0, 6).map((cell) => styleOf(cell).backgroundColor)).toEqual([
      // The 1st planned nothing: drawn like a day with nothing done.
      HEAT[0].fill,
      ...HEAT.map((step) => step.fill),
    ]);
    // The number on a square takes the ink that reads on its shade.
    const inks = cells.slice(1, 6).map((cell) => styleOf(cell.find((node) => (node.type as unknown) === 'Text')).color);
    expect(inks).toEqual(HEAT.map((step) => appLightTheme.colors[step.onFill]));
  });

  it('rings today and leaves the days to come as quiet outlines', () => {
    const cells = dayCells(heatMap('month', tallies('month', () => [2, 2])));
    const [yesterday, today, tomorrow] = [cells[16], cells[17], cells[18]].map(styleOf);
    expect(today.borderColor).toBe(appLightTheme.colors.onSurface);
    expect(yesterday.borderColor).toBe(yesterday.backgroundColor);
    expect(tomorrow.backgroundColor).toBeUndefined();
    expect(tomorrow.borderColor).toBe(getAppPalette('light').track);
  });

  it('draws a week as seven squares with done over planned under each', () => {
    const tree = heatMap('week', tallies('week', (date) => (date === TODAY ? [1, 3] : [2, 3])));
    expect(dayCells(tree).map(textOf)).toEqual(['16', '17', '18', '19', '20', '21', '22']);
    expect(textOf(tree.root)).toContain('162/3172/3181/319202122');
    // A day with nothing planned shows a dash; a day to come shows nothing.
    expect(textOf(heatMap('week', tallies('week', () => [0, 0])).root)).toContain('16–17–18–19202122');
  });

  it('draws a year as small squares up to today, with no numbers, under twelve initials', () => {
    const days = tallies('year', () => [1, 1]);
    const tree = heatMap('year', days);
    const svg = tree.root.find((node) => (node.type as unknown) === 'RNSVGSvgView');
    expect(svg.props.bbWidth).toBe(296);
    const squares = svg.findAll((node) => (node.type as unknown) === 'RNSVGRect');
    expect(squares).toHaveLength(days.filter((day) => day.date <= TODAY).length);
    expect(squares).toHaveLength(52 * 7 - 4);
    expect(dayCells(tree)).toHaveLength(0);
    expect(textOf(tree.root)).toBe('DJFMAMJJASONLessMore');
  });

  it('carries a legend of the five shades, least to most', () => {
    const tree = heatMap('month', tallies('month', () => [0, 0]));
    const legend = hostNodes(tree, (node) => node.props.importantForAccessibility === 'no-hide-descendants')[0];
    expect(textOf(legend)).toBe('LessMore');
    const swatches = legend.findAll(
      (node) => typeof node.type === 'string' && styleOf(node).backgroundColor !== undefined,
    );
    expect(swatches.map((swatch) => styleOf(swatch).backgroundColor)).toEqual(HEAT.map((step) => step.fill));
  });
});

describe('ReviewStandings', () => {
  const ROWS: StandingRow[] = [
    {
      id: 'smoke',
      name: 'No Smoking',
      kind: 'tick',
      share: 0.95,
      figure: '19 / 20',
      spoken: { key: 'spoken.days', params: { name: 'No Smoking', done: 19, count: 20, missed: 1, skipped: 0 } },
    },
    {
      id: 'sit',
      name: 'Meditation',
      kind: 'timer',
      share: 0.5,
      figure: '10 / 20',
      spoken: { key: 'spoken.days', params: { name: 'Meditation', done: 10, count: 20, missed: 10, skipped: 2 } },
    },
  ];
  const standings = (rows: StandingRow[], onOpenTracker: (id: string) => void = () => undefined) =>
    render(React.createElement(ReviewStandings, { title: 'Holding', rows, onOpenTracker }));
  const buttons = (tree: ReactTestRenderer) => hostNodes(tree, (node) => node.props.accessibilityRole === 'button');

  it('draws nothing at all without rows', () => {
    const tree = standings([]);
    expect(textOf(tree.root)).toBe('');
    expect(hostNodes(tree, (node) => styleOf(node).backgroundColor !== undefined)).toEqual([]);
  });

  it('gives each tracker a row with its name, its tally and a spoken summary', () => {
    const tree = standings(ROWS);
    expect(textOf(tree.root)).toBe('HoldingNo Smoking19 / 20Meditation10 / 20');
    expect(buttons(tree).map((row) => row.props.accessibilityLabel)).toEqual([
      'No Smoking: 19 of 20 days done, 1 missed, 0 skipped',
      'Meditation: 10 of 20 days done, 10 missed, 2 skipped',
    ]);
    expect(buttons(tree).every((row) => row.props.accessibilityHint === 'Opens history')).toBe(true);
  });

  it('colours the dot and the bar by kind, and fills the bar to the share done', () => {
    const { kind, track } = getAppPalette('light');
    const [first, second] = buttons(standings(ROWS));
    const paints = (row: ReactTestInstance) =>
      row
        .findAll((node) => typeof node.type === 'string' && styleOf(node).backgroundColor !== undefined && node !== row)
        .map(styleOf);
    const [dot, bar, fill] = paints(first);
    expect(dot.backgroundColor).toBe(kind.tick.ink);
    expect(bar.backgroundColor).toBe(track);
    expect([fill.backgroundColor, fill.width]).toEqual([kind.tick.ink, '95%']);
    expect(paints(second)[2]).toMatchObject({ backgroundColor: kind.timer.ink, width: '50%' });
  });

  it('states a floor for its rows, and opens the tracker a row is for', () => {
    const opened: string[] = [];
    const tree = standings(ROWS, (id) => opened.push(id));
    const [first] = buttons(tree);
    expect(styleOf(first).minHeight).toBeGreaterThanOrEqual(40);
    expect(styleOf(first).height).toBeUndefined();
    const press = tree.root.findAll(
      (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0].props.onPress as () => void;
    act(() => press());
    expect(opened).toEqual(['smoke']);
  });
});

describe('history drawings', () => {
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
    expect(i18n.t('review:facts.fullDays', { count: 1 })).toBe('full day');
    expect(i18n.t('review:facts.run', { count: 0 })).toBe('days in a row now');
    expect(i18n.t('review:statement.nothing.year')).toBe('Nothing was planned this year.');
    expect(i18n.t('review:heat.a11y', { title: 'November', full: 6, partial: 9, empty: 5 })).toBe(
      'November. Full days: 6. Partly done: 9. Nothing done: 5.',
    );
  });

  it('reads plainly in French', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('review:statement.down.month', { percent: 78, previous: 86 })).toBe(
      'Vous avez fait <b>78 %</b> de ce que vous aviez prévu, moins que les 86 % du mois précédent.',
    );
    expect(i18n.t('review:spoken.days', { name: 'Lire', done: 4, count: 6, missed: 2, skipped: 0 })).toBe(
      'Lire : 4 jours faits sur 6, 2 manqués, 0 sautés',
    );
    expect(i18n.t('review:facts.fullDays', { count: 0 })).toBe('jour complet');
    expect(i18n.t('review:facts.run', { count: 4 })).toBe('jours d’affilée');
    expect([i18n.t('review:sections.holding'), i18n.t('review:sections.slipping')]).toEqual(['Ça tient', 'Ça décroche']);
  });
});
