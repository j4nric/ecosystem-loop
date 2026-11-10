import type { Locale } from '@core/api';
import { de, type Strings } from './de.ts';
import { en } from './en.ts';
import { pickLocale } from './locale.ts';

const dictionaries: Record<Locale, Strings> = { de, en };

/** Gerätesprache (de/en), sonst Englisch. `?lang=en` erzwingt eine Sprache (zum Testen). */
export function detectLocale(): Locale {
  const forced = new URLSearchParams(window.location.search).get('lang');
  const langs = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  return pickLocale(forced, langs);
}

export const locale: Locale = detectLocale();
export const t: Strings = dictionaries[locale];
document.documentElement.lang = locale;
