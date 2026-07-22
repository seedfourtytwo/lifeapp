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
