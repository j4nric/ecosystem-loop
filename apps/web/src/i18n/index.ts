import type { Locale } from '@core/api';
import { de, type Strings } from './de.ts';
import { en } from './en.ts';

const dictionaries: Record<Locale, Strings> = { de, en };

/** Gerätesprache, Fallback Deutsch. `?lang=en` erzwingt eine Sprache (zum Testen). */
export function detectLocale(): Locale {
  const forced = new URLSearchParams(window.location.search).get('lang');
  if (forced === 'de' || forced === 'en') return forced;
  const langs = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const code = lang.toLowerCase().slice(0, 2);
    if (code === 'de' || code === 'en') return code;
  }
  return 'de';
}

export const locale: Locale = detectLocale();
export const t: Strings = dictionaries[locale];
document.documentElement.lang = locale;
