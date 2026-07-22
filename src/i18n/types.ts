export {
  APP_LANGUAGES,
  isAppLanguage,
  type AppLanguage,
} from '../protocol/appSettings';

export const RESOLVED_LANGUAGES = ['en', 'fr'] as const;
export type ResolvedLanguage = (typeof RESOLVED_LANGUAGES)[number];
