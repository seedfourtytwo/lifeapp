import enHome from '../src/i18n/locales/en/home.json';
import frHome from '../src/i18n/locales/fr/home.json';
import enJournal from '../src/i18n/locales/en/journal.json';
import enNutrition from '../src/i18n/locales/en/nutrition.json';
import frNutrition from '../src/i18n/locales/fr/nutrition.json';
import frJournal from '../src/i18n/locales/fr/journal.json';
import {
  applyAppLanguage,
  deviceLanguageCodes,
  getDateLocale,
  getSpeechLocale,
  i18n,
  resolveLanguage,
} from '../src/i18n';

describe('i18n language resolution', () => {
  afterEach(async () => {
    await applyAppLanguage('en');
  });

  it('resolves system from device language codes when supported', () => {
    const spy = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'fr-FR',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(deviceLanguageCodes()).toContain('fr');
    expect(resolveLanguage('system')).toBe('fr');
    spy.mockRestore();
  });

  it('falls back to en for unsupported system locales', () => {
    const spy = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'de-DE',
    } as Intl.ResolvedDateTimeFormatOptions);
    expect(resolveLanguage('system')).toBe('en');
    spy.mockRestore();
  });

  it('honors explicit preferences', () => {
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage('en')).toBe('en');
  });

  it('switches catalogs, date locale, and speech locale language', async () => {
    await applyAppLanguage('fr');
    expect(i18n.t('settings:appearance.languageFr')).toBe('Français');
    expect(i18n.t('home:dock.habitsTab')).toBe('Habitudes');
    expect(getDateLocale()).toBe('fr-FR');
    expect(getSpeechLocale().toLowerCase().startsWith('fr')).toBe(true);

    await applyAppLanguage('en');
    expect(i18n.t('settings:appearance.sectionTitle')).toBe('Appearance');
    expect(getDateLocale()).toBe('en-US');
    expect(getSpeechLocale().toLowerCase().startsWith('en')).toBe(true);
  });
});

/**
 * The Home namespace after the floating weather bubble was retired.
 *
 * The bubble's strings lived under `chromeBubble`, and the half of them that
 * survived — what the weather chip says out loud — moved to `weatherChip`.
 * Renaming a block is exactly the change that leaves one locale behind, so the
 * two catalogues are compared key for key here rather than by eye.
 */
describe('home namespace copy', () => {
  const en = enHome as Record<string, unknown>;
  const fr = frHome as Record<string, unknown>;

  function paths(value: unknown, prefix = ''): string[] {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return [prefix];
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it('ships every Home key in both locales', () => {
    expect(paths(fr).sort()).toEqual(paths(en).sort());
  });

  it('has no chromeBubble block left', () => {
    expect(en.chromeBubble).toBeUndefined();
    expect(fr.chromeBubble).toBeUndefined();
  });

  it('says what the weather chip announces', () => {
    for (const catalog of [en, fr]) {
      const chip = catalog.weatherChip as Record<string, unknown> | undefined;
      expect(chip).toBeDefined();
      for (const key of [
        'weatherWithCondition',
        'weatherOffline',
        'weatherLoading',
        'weatherUnavailable',
        'rainChance',
        'humidity',
        'trendImproving',
        'trendWorsening',
        'trendSteady',
        'tapToExpandForecast',
        'tapToCollapseForecast',
        'forecastExpanded',
        'forecastCollapsed',
        'forecastTitle',
      ]) {
        expect(typeof chip![key]).toBe('string');
      }
    }
  });

  it('drops the strings that only made sense for a draggable bubble', () => {
    const flat = paths(en);
    for (const gone of [
      'chromeBubble.opensCalendar',
      'chromeBubble.openCalendarWithCount',
      'chromeBubble.todayDate',
      'chromeBubble.upcomingCount',
      'chromeBubble.longPressForCalendar',
      'chromeBubble.showCalendar',
    ]) {
      expect(flat).not.toContain(gone);
    }
  });

  it('kept the calendar peek strings the recovered sheet needs', () => {
    for (const catalog of [en, fr]) {
      const peek = catalog.calendarPeek as Record<string, unknown> | undefined;
      expect(peek).toBeDefined();
      for (const key of [
        'title',
        'emptySubtitle',
        'withListSubtitle',
        'emptyBody',
        'openCalendar',
        'openFullCalendar',
        'fullCalendar',
        'add',
        'close',
        'markDoneA11y',
        'couldNotMarkDoneTitle',
      ]) {
        expect(typeof peek![key]).toBe('string');
      }
    }
  });
});

/**
 * The journal namespace, both locales.
 *
 * `journal` grew a whole `chapters` block when a notebook day stopped being
 * one document, and a block is exactly the change that lands in `en` and not
 * in `fr` — every string in it is a button or an announcement a French reader
 * would otherwise meet in English.
 */
describe('journal namespace copy', () => {
  const en = enJournal as Record<string, unknown>;
  const fr = frJournal as Record<string, unknown>;

  function keyPaths(value: unknown, prefix = ''): string[] {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return [prefix];
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it('ships every journal key in both locales', () => {
    expect(keyPaths(fr).sort()).toEqual(keyPaths(en).sort());
  });

  it('names every chapter control in both locales', () => {
    for (const catalog of [en, fr]) {
      const chapters = catalog.chapters as Record<string, unknown> | undefined;
      expect(chapters).toBeDefined();
      for (const key of [
        'label',
        'jumpLabel',
        'of',
        'jumpA11y',
        'previousA11y',
        'nextA11y',
        'addA11y',
        'deleteA11y',
        'deleteTitle',
        'deleteBody',
        'deleteAction',
        'countA11y',
      ]) {
        expect(typeof chapters![key]).toBe('string');
      }
    }
  });

  it('names every control on the chapter picker in both locales', () => {
    for (const catalog of [en, fr]) {
      const share = catalog.share as Record<string, unknown> | undefined;
      expect(share).toBeDefined();
      for (const key of [
        'shareTitle',
        'copyTitle',
        'selectAll',
        'selectNone',
        'selectedCount',
        'toggleA11y',
        'statusNever',
        'statusStale',
        'statusCurrent',
        'confirmShare',
        'confirmCopy',
        'cancel',
        'nothingSelected',
      ]) {
        expect(typeof share![key]).toBe('string');
      }
    }
  });
});

/**
 * The Nutrition namespace, after the food journal was added to the tab.
 *
 * The journal strings arrive as a block, and a block is exactly what gets added
 * to one locale and forgotten in the other — so the two catalogues are compared
 * key for key, and the strings the affordance cannot work without are named.
 */
describe('nutrition namespace copy', () => {
  const en = enNutrition as Record<string, unknown>;
  const fr = frNutrition as Record<string, unknown>;

  function paths(value: unknown, prefix = ''): string[] {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return [prefix];
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it('ships every Nutrition key in both locales', () => {
    expect(paths(fr).sort()).toEqual(paths(en).sort());
  });

  it('says what the food journal affordance needs to say', () => {
    for (const catalog of [en, fr]) {
      const journal = catalog.foodJournal as Record<string, unknown> | undefined;
      expect(journal).toBeDefined();
      for (const key of [
        'notebookName',
        'startAction',
        'startHint',
        'confirmTitle',
        'confirmBody',
        'confirmStart',
        'capTitle',
        'capBody',
        'couldNotStartTitle',
      ]) {
        expect(typeof journal![key]).toBe('string');
      }
    }
  });

  it('tells the reader what a full notebook budget means', () => {
    for (const catalog of [en, fr]) {
      const journal = catalog.foodJournal as Record<string, string>;
      expect(journal.capBody).toContain('{{max}}');
      expect(journal.confirmBody).toContain('{{max}}');
    }
  });
});
