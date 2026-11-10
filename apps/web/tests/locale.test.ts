/** Sprachwahl: Gerätesprache de/en, sonst Englisch (Hauptsprache laut Konzept); `?lang=` erzwingt. */
import { describe, expect, it } from 'vitest';
import { pickLocale } from '../src/i18n/locale.ts';

describe('pickLocale', () => {
  it('nimmt Deutsch für deutschsprachige Geräte (auch de-AT, de-CH)', () => {
    expect(pickLocale(null, ['de-DE'])).toBe('de');
    expect(pickLocale(null, ['de-AT', 'en-US'])).toBe('de');
    expect(pickLocale(null, ['DE-ch'])).toBe('de');
  });

  it('nimmt Englisch für englischsprachige Geräte', () => {
    expect(pickLocale(null, ['en-GB', 'de-DE'])).toBe('en');
  });

  it('nimmt die erste unterstützte Sprache der Liste', () => {
    expect(pickLocale(null, ['fr-FR', 'de-DE', 'en-US'])).toBe('de');
    expect(pickLocale(null, ['ja', 'en'])).toBe('en');
  });

  it('fällt auf Englisch zurück, wenn weder de noch en vorkommt', () => {
    expect(pickLocale(null, ['fr-FR', 'es-ES'])).toBe('en');
    expect(pickLocale(null, [])).toBe('en');
  });

  it('erzwingt eine Sprache über ?lang=, ignoriert unbekannte Werte', () => {
    expect(pickLocale('de', ['en-US'])).toBe('de');
    expect(pickLocale('en', ['de-DE'])).toBe('en');
    expect(pickLocale('fr', ['de-DE'])).toBe('de');
    expect(pickLocale('', ['it-IT'])).toBe('en');
  });
});
