/** Datenprüfung: Schema und Querverweise werden gemeldet. */
import { describe, expect, it } from 'vitest';
import { buildGameData, DATA_FILES, DataError } from '../src/data.ts';
import { data, dataWith, raw } from './helpers.ts';

function problems(patch: Parameters<typeof dataWith>[0]): string[] {
  try {
    dataWith(patch);
  } catch (e) {
    if (e instanceof DataError) return e.problems;
    throw e;
  }
  return [];
}

describe('Spieldaten', () => {
  it('die mitgelieferten Daten sind gültig und vollständig', () => {
    expect(data.geographies.size).toBe(5);
    expect(data.zones).toHaveLength(5);
    expect(data.seasons.map((s) => s.id)).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(data.couplings.map((c) => c.id)).toEqual(['snowmelt', 'freshwater', 'forest_climate', 'flooding']);
    expect(data.scenarios.size).toBeGreaterThanOrEqual(3);
    expect(data.config.starterDeck.length).toBeGreaterThanOrEqual(8);
    expect(data.config.starterDeck.length).toBeLessThanOrEqual(10);
    for (const c of ['thunderstorm', 'drought', 'storm', 'frost', 'rain', 'sun', 'seeds', 'fertilizer', 'healing'])
      expect(data.cards.has(c), c).toBe(true);
    expect(Object.keys(DATA_FILES).sort()).toEqual(Object.keys(raw).sort());
  });

  it('jeder Text hat de und en', () => {
    expect(problems((r) => delete r.cards.cards[0].name.en)[0]).toMatch(/cards\.yaml: cards\.0\.name\.en/);
  });

  it('Schemafehler mehrerer Dateien werden gesammelt', () => {
    const p = problems((r) => {
      r.config.turn.handSize = 0;
      r.map.zones = 'kaputt';
    });
    expect(p.some((x) => x.startsWith('config.yaml'))).toBe(true);
    expect(p.some((x) => x.startsWith('map.yaml'))).toBe(true);
  });

  const broken: [string, Parameters<typeof dataWith>[0], RegExp][] = [
    [
      'unbekannter Wert in Form',
      (r) => (r.geographies.geographies[0].forms[0].when[0].stat = 'heat'),
      /unbekannter Wert heat/,
    ],
    [
      'fremder Wert in Form',
      (r) => (r.geographies.geographies[0].forms[0].when[0].stat = 'salt'),
      /salt gibt es hier nicht/,
    ],
    ['letzte Form nicht „sonst“', (r) => r.geographies.geographies[0].forms.pop(), /letzte Form/],
    ['Form doppelt', (r) => (r.geographies.geographies[1].forms[0].id = 'glacier'), /Form doppelt: glacier/],
    ['Ruhewert fehlt', (r) => delete r.geographies.geographies[0].rest.snow, /Ruhewert für snow fehlt/],
    ['Ruhewert fremd', (r) => (r.geographies.geographies[0].rest.salt = 1), /fremden Wert salt/],
    ['Ruhewert außerhalb der Skala', (r) => (r.geographies.geographies[0].rest.snow = 9), /außerhalb/],
    ['Sonderwert ist gemeinsam', (r) => (r.geographies.geographies[0].special = 'light'), /schon gemeinsam/],
    ['unbekannte Geografie der Zone', (r) => (r.map.zones[0].geography = 'moon'), /unbekannte Geografie moon/],
    ['unbekannter Nachbar', (r) => r.map.zones[0].neighbors.push('moon'), /unbekannter Nachbar moon/],
    ['einseitige Nachbarschaft', (r) => r.map.zones[0].neighbors.push('coast'), /nicht beidseitig/],
    ['Nachbar von sich selbst', (r) => r.map.zones[0].neighbors.push('mountains'), /sich selbst/],
    ['Startwert fremd', (r) => (r.map.zones[0].start = { salt: 1 }), /fremden Wert salt/],
    ['unbekannte Start-Jahreszeit', (r) => (r.seasons.start = 'monsoon'), /Start-Jahreszeit/],
    [
      'Jahreszeit: unbekannte Geografie',
      (r) => (r.seasons.seasons[2].rules[0].geographies = ['moon']),
      /Geografie moon/,
    ],
    ['Jahreszeit: Effektziel', (r) => (r.seasons.seasons[1].rules[0].effects[0].at = 'source'), /Effektziel source/],
    ['Kopplung: Jahreszeit', (r) => (r.couplings.couplings[0].seasons = ['monsoon']), /Jahreszeit monsoon/],
    ['Kopplung: Quelle', (r) => (r.couplings.couplings[0].from.geography = 'moon'), /Geografie moon/],
    ['Kopplung: Ziel', (r) => (r.couplings.couplings[0].to.geography = 'moon'), /Geografie moon/],
    ['Kopplung: transfer-Quelle', (r) => (r.couplings.couplings[0].effects[0].from = 'other'), /transfer from=other/],
    ['Karte: Kategorie', (r) => (r.cards.cards[0].category = 'curse'), /Kategorie curse/],
    ['Karte: Effektziel', (r) => (r.cards.cards[0].effects[0].at = 'other'), /Effektziel other/],
    ['Karte: Schwelle at', (r) => (r.cards.cards[0].triggers[0].at = 'other'), /Schwelle fire at=other/],
    ['Karte: Nachbar-Slot', (r) => (r.cards.cards[2].slots[1].of = 'later'), /Slot fall verweist/],
    ['Karte: Slot doppelt', (r) => r.cards.cards[0].slots.push({ id: 'zone', kind: 'zone' }), /Slot doppelt/],
    ['Karte doppelt', (r) => r.cards.cards.push(r.cards.cards[0]), /Karte doppelt: thunderstorm/],
    ['Bedingung: Form', (r) => (r.cards.cards[0].triggers[0].when = [{ form: 'castle' }]), /unbekannte Form castle/],
    ['Bedingung: Geografie', (r) => (r.cards.cards[0].slots[0].when = [{ geography: 'moon' }]), /Geografie moon/],
    [
      'Bedingung: verschachtelt',
      (r) =>
        (r.cards.cards[0].slots[0].when = [
          { not: [{ hasStat: 'heat' }] },
          { any: [{ season: 'monsoon' }] },
          { anyNeighbor: [{ stat: 'x', gte: 1 }] },
        ]),
      /heat[\s\S]*monsoon|monsoon[\s\S]*heat/,
    ],
    ['Szenario: Zone', (r) => (r.scenarios.scenarios[0].zones = { moon: {} }), /unbekannte Zone moon/],
    ['Szenario: Wert', (r) => (r.scenarios.scenarios[0].adjust = { heat: 1 }), /unbekannter Wert heat/],
    ['Szenario standard fehlt', (r) => (r.scenarios.scenarios[0].id = 'other'), /standard/],
    ['Pipeline: Modul', (r) => r.config.pipeline.push('weather'), /unbekanntes Modul weather/],
    ['rules: Modul', (r) => (r.config.rules.weather = {}), /rules: unbekanntes Modul weather/],
    ['rules: Parameter', (r) => (r.config.rules.healing.interval = 0), /rules\.healing\.interval/],
    ['rules: Parameter fehlen', (r) => delete r.config.rules.breath, /rules\.breath/],
    ['Textbaustein fehlt', (r) => delete r.config.texts['effect.adjust'], /effect\.adjust fehlt/],
    ['Startdeck: Karte', (r) => r.config.starterDeck.push('nope'), /unbekannte Karte nope/],
    ['Startdeck: Größe', (r) => (r.config.starterDeck = ['rain']), /1 Karten, erlaubt 8–10/],
  ];
  it.each(broken)('meldet: %s', (_name, patch, expected) => {
    const p = problems(patch);
    expect(p.join('\n')).toMatch(expected);
  });

  it('DataError listet alle Probleme in der Meldung', () => {
    const r = structuredClone(raw) as typeof raw & { config: { starterDeck: string[] } };
    r.config.starterDeck = ['nope'];
    expect(() => buildGameData(r)).toThrow(/Spieldaten fehlerhaft:[\s\S]*nope/);
  });
});
