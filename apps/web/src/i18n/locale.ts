/** Sprachen der App; Spieltexte in den Daten (YAML) tragen dieselben Schlüssel. */
export type Locale = 'de' | 'en';

/**
 * Sprache wählen (rein, ohne DOM): `forced` (`?lang=`) gewinnt, sonst die erste Gerätesprache, die de oder en ist.
 * Englisch ist laut Konzept die Hauptsprache und damit der Fallback für alle anderen Gerätesprachen.
 */
export function pickLocale(forced: string | null, languages: readonly string[]): Locale {
  if (forced === 'de' || forced === 'en') return forced;
  for (const lang of languages) {
    const code = lang.toLowerCase().slice(0, 2);
    if (code === 'de' || code === 'en') return code;
  }
  return 'en';
}
