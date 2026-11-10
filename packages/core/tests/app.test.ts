/** Wünsche der Web-App (Phase 5): Gruppe je Art, validateState, gameOver, lesbare Kartentexte, Kurztext. */
import { describe, expect, it } from 'vitest';
import { cardShort, cardText, SHORT_MAX } from '../src/cards/text.ts';
import { newGame, validateState, view } from '../src/game.ts';
import { recordGame, newBook } from '../src/meta.ts';
import { data, dataWith, endTurn, game, setPops, setStats } from './helpers.ts';

describe('Gruppe je Art', () => {
  it('jede Art hat eine Gruppe; Frosch ist Amphibie', () => {
    const groups = Object.fromEntries([...data.species.values()].map((s) => [s.id, s.group]));
    expect(groups).toMatchObject({
      plankton: 'water',
      beetle: 'insect',
      frog: 'amphibian',
      lizard: 'reptile',
      bird: 'bird',
      deer: 'mammal',
      human: 'human',
    });
  });

  it('ZoneView.populations nennt die Gruppe', () => {
    const s = game({ life: false });
    setPops(s, 'river', { frog: 2 });
    const pops = view(data, s, 'de').zones.find((z) => z.id === 'river')!.populations;
    expect(pops).toEqual([{ species: 'frog', name: 'Frosch', tier: 3, count: 2, group: 'amphibian' }]);
  });

  it('unbekannte Gruppe ist ein Datenfehler', () => {
    expect(() =>
      dataWith((r) => {
        r.species.species[0].group = 'fungus';
      }),
    ).toThrow(/group/);
  });
});

describe('validateState', () => {
  const fresh = () => newGame(data, { seed: 7 });
  const broken = (patch: (s: ReturnType<typeof fresh>) => void) => {
    const s = structuredClone(fresh());
    patch(s);
    return validateState(data, s);
  };
  const reason = (r: ReturnType<typeof validateState>) => (r.ok ? '' : r.reason);

  it('frischer und gespielter Zustand (auch als JSON) sind gültig', () => {
    expect(validateState(data, fresh())).toEqual({ ok: true });
    const start = game({ hand: [], draw: ['rain', 'sun'] });
    start.nextUid = 2000; // Hilfsfunktion vergibt uids ab 1000 ohne nextUid
    const later = endTurn(start).state;
    expect(validateState(data, JSON.parse(JSON.stringify(later)))).toEqual({ ok: true });
  });

  it('kein Objekt, falsche Version, kaputtes Format', () => {
    expect(reason(validateState(data, null))).toMatch(/kein Objekt/);
    expect(reason(validateState(data, [1]))).toMatch(/kein Objekt/);
    expect(reason(broken((s) => ((s as { version: number }).version = 3)))).toMatch(/Version 3 statt 4/);
    expect(reason(broken((s) => delete (s as Partial<typeof s>).hand))).toMatch(/Format: hand/);
    expect(reason(broken((s) => (s.zones[0]!.stats.light = 1.5)))).toMatch(/Format: zones\.0\.stats\.light/);
  });

  it('unbekannte Ids', () => {
    expect(reason(broken((s) => (s.scenario = 'mars')))).toMatch(/Szenario mars/);
    expect(reason(broken((s) => s.zones.pop()))).toMatch(/Zonen/);
    expect(reason(broken((s) => (s.zones[0]!.geography = 'desert')))).toMatch(/Geografie desert/);
    expect(reason(broken((s) => (s.zones[0]!.stats.lava = 1)))).toMatch(/unbekannter Wert lava/);
    expect(reason(broken((s) => delete s.zones[1]!.stats.deadwood))).toMatch(/Wert deadwood fehlt/);
    expect(reason(broken((s) => (s.zones[0]!.form = 'reef')))).toMatch(/Form reef/);
    expect(reason(broken((s) => s.zones[0]!.neighbors.push('moon')))).toMatch(/Nachbarzone moon/);
    expect(reason(broken((s) => (s.zones[0]!.populations.dodo = 1)))).toMatch(/Art dodo/);
    expect(reason(broken((s) => (s.zones[0]!.evolution.dodo = 1)))).toMatch(/Art dodo/);
    expect(reason(broken((s) => (s.hand[0]!.card = 'joker')))).toMatch(/Karte joker/);
    expect(reason(broken((s) => (s.cardPlays.joker = 1)))).toMatch(/Karte joker/);
    expect(reason(broken((s) => s.extinctions.push({ species: 'dodo', round: 1 })))).toMatch(/Art dodo/);
    expect(reason(broken((s) => (s.species.dodo = { since: 0, extinct: null })))).toMatch(/Art dodo/);
    expect(reason(broken((s) => (s.forecast = { event: 'ufo', round: 1, strength: 1, zone: null })))).toMatch(
      /Ereignis ufo/,
    );
    expect(reason(broken((s) => (s.forecast = { event: 'locusts', round: 1, strength: 1, zone: 'moon' })))).toMatch(
      /Ereignis-Zone moon/,
    );
  });

  it('Wertebereiche und Karten-uids', () => {
    expect(reason(broken((s) => (s.zones[0]!.stats.light = 9)))).toMatch(/light = 9 außerhalb 0–5/);
    expect(reason(broken((s) => (s.zones[0]!.level = 0)))).toMatch(/Stufe 0/);
    expect(reason(broken((s) => (s.zones[0]!.populations.beetle = 12)))).toMatch(/Bestand beetle = 12/);
    expect(reason(broken((s) => (s.harmony = 500)))).toMatch(/Harmonie 500/);
    expect(reason(broken((s) => (s.hand[1]!.uid = s.hand[0]!.uid)))).toMatch(/uid doppelt/);
    expect(reason(broken((s) => (s.nextUid = 1)))).toMatch(/nextUid/);
  });
});

describe('Partie-Ende: gameOver', () => {
  it('der Schritt zum Kollaps meldet collapsed und zuletzt gameOver mit Runde und Punkten', () => {
    const s = game({ hand: [], draw: [] });
    s.harmony = 1;
    s.score = 17;
    setStats(s, 'mountains', { vegetation: 0, snow: 0, moisture: 0 });
    setStats(s, 'river', { water: 2 }); // Bach: der Frühling macht den Fluss nicht zur Aue (+2)
    const { state, events } = endTurn(s);
    expect(state.phase).toBe('over');
    expect(events.at(-1)).toEqual({ type: 'gameOver', round: 1, score: state.score });
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(events.findIndex((e) => e.type === 'collapsed')).toBeLessThan(events.length - 1);
    // Die Oberfläche trägt danach genau einmal ein.
    expect(recordGame(data, newBook(), state).book.games).toBe(1);
  });

  it('normale Runden melden kein gameOver', () => {
    const { events } = endTurn(game({ hand: [], draw: [] }));
    expect(events.some((e) => e.type === 'gameOver')).toBe(false);
  });
});

describe('Kartentexte (de/en): Wirkung zuerst, Bedingung als kurzer Zusatz', () => {
  const text = (id: string) => [cardText(data, data.cards.get(id)!, 'de'), cardText(data, data.cards.get(id)!, 'en')];

  it('Algenblüte: Bedingung als Geografien', () => {
    expect(text('algal_bloom')).toEqual([
      'Vegetation +1, Licht −1. Nur für Fluss oder Küste.',
      'Vegetation +1, Light −1. Only on River or Coast.',
    ]);
  });

  it('Zersetzung: Nachbarzone mit eigener Bedingung', () => {
    expect(text('decomposition')).toEqual([
      'Totholz −1, Boden +1 nebenan. Nur für Wald, mit Nachbarzone Flachland.',
      'Deadwood −1, Soil +1 next door. Only on Forest, next to Plains.',
    ]);
  });

  it('Gewitter (Weltkarte): Wirkung je Geografie, Schwellen danach mit ihren Geografien', () => {
    expect(text('thunderstorm')).toEqual([
      'Alle Zonen: Feuchte +2 · Fluss Wasserstand +1. ' +
        '🔥 Feuer bei (Wald oder Flachland) und Feuchte ≤ 1 und Vegetation ≥ 1: Vegetation auf 0, Totholz +3 (Störung). ' +
        '🌊 Flut bei (Berge oder Flachland) und Feuchte ≥ 4: Vegetation −1, Feuchte +1 auf allen Nachbarzonen (Störung).',
      'All zones: Moisture +2 · River Water level +1. ' +
        '🔥 Fire if (Forest or Plains) and Moisture ≤ 1 and Vegetation ≥ 1: Vegetation to 0, Deadwood +3 (disturbance). ' +
        '🌊 Deluge if (Mountains or Plains) and Moisture ≥ 4: Vegetation −1, Moisture +1 on all neighbouring zones (disturbance).',
    ]);
  });

  it('Feuer: Schwellen-Bedingung, die das Ziel schon verlangt, wird nicht wiederholt', () => {
    expect(text('fire')).toEqual([
      '🔥 Brandrodung: Vegetation auf 0, Totholz +3, Boden +1 (Störung). Nur wo Vegetation ≥ 1.',
      '🔥 Slash and burn: Vegetation to 0, Deadwood +3, Soil +1 (disturbance). Only where Vegetation ≥ 1.',
    ]);
  });

  it('Siedlung und Laichzug: „wo … lebt“', () => {
    expect(text('settlement')).toEqual([
      'Bestand Mensch +2. Nur wo Mensch lebt.',
      'Human population +2. Only where Human lives.',
    ]);
    expect(text('spawning_run')[1]).toBe('1 Fish migrates next door. Only where Fish lives, next to River or Coast.');
  });

  it('seltene Bedingungen: weiterer Zonen-Slot, Nachbar mit Wert, Bedingung ohne Einschränkung', () => {
    const d = dataWith((r) => {
      const card = r.cards.cards.find((c: { id: string }) => c.id === 'decomposition');
      card.slots = [
        { id: 'zone', kind: 'zone', when: [{ hasStat: 'light' }, { stat: 'moisture', gte: 2 }] },
        { id: 'target', kind: 'neighbor', of: 'zone', when: [{ stat: 'vegetation', lte: 3 }] },
        { id: 'far', kind: 'zone', when: [{ geography: 'coast' }] },
      ];
      card.effects = [{ adjust: 'soil', by: 1, at: 'far' }];
    });
    expect(cardText(d, d.cards.get('decomposition')!, 'de')).toBe(
      'Boden +1 (Zone). Nur wo Feuchte ≥ 2, neben einer Zone mit Vegetation ≤ 3, Zone für Küste.',
    );
  });
});

describe('CardView.short', () => {
  it('jede Karte hat einen Kurztext von höchstens 40 Zeichen', () => {
    for (const c of data.cards.values())
      for (const locale of ['de', 'en'] as const) {
        const s = cardShort(data, c, locale);
        expect([...s].length, `${c.id} ${s}`).toBeLessThanOrEqual(SHORT_MAX);
        expect(s, c.id).not.toMatch(/\{\w+\}/);
      }
  });

  it('Hauptwirkung, Schwellen-Symbole, Wahl, nur Schwelle', () => {
    const short = (id: string, locale: 'de' | 'en' = 'de') => cardShort(data, data.cards.get(id)!, locale);
    expect(short('thunderstorm')).toBe('🌍 Feuchte↑↑ · Wasserstand↑ 🔥 🌊');
    expect(short('balance')).toBe('Alle Werte 1 Schritt zur Ruhe ringsum');
    expect(short('blessing', 'en')).toBe('Vegetation +1 everywhere');
    expect(short('scout_eye')).toBe('Wähle: Abwenden oder Verschieben');
    expect(short('fire', 'en')).toBe('🔥 Slash and burn');
  });

  it('zu lange Wirkungen werden gekürzt; Karte ohne Wirkung zeigt den Namen', () => {
    const d = dataWith((r) => {
      r.config.texts['effect.draw'] = { de: 'ziehe {n} Karten und noch sehr viel mehr Text dazu', en: 'draw {n}' };
      const shade = r.cards.cards.find((c: { id: string }) => c.id === 'shade');
      shade.effects = [];
      shade.triggers = [];
    });
    const s = cardShort(d, d.cards.get('inspiration')!, 'de');
    expect([...s].length).toBe(SHORT_MAX);
    expect(s.endsWith('…')).toBe(true);
    expect(cardShort(d, d.cards.get('shade')!, 'en')).toBe('Shade');
  });

  it('view() liefert short neben dem vollen Text', () => {
    const v = view(data, game({ hand: ['algal_bloom'] }), 'de').hand[0]!;
    expect(v.short).toBe('Vegetation +1, Licht −1');
    expect(v.text).toBe('Vegetation +1, Licht −1. Nur für Fluss oder Küste.');
  });
});

describe('validateState gegen exotische Eingaben', () => {
  it('wirft nie, auch nicht bei werfenden Gettern', () => {
    const evil = new Proxy(
      {},
      {
        get() {
          throw new Error('böse');
        },
      },
    );
    expect(validateState(data, evil).ok).toBe(false);
  });
});
