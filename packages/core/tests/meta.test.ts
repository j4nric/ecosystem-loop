/** Konzept 10: Schöpfungsbuch, Freischaltungen, Kartenpool, Startdeck, variierende Startwelten. */
import { describe, expect, it } from 'vitest';
import { newGame, slotOptions, view } from '../src/game.ts';
import {
  bookStat,
  cardPool,
  dailySeed,
  deckIssueText,
  newBook,
  parseBook,
  recordGame,
  validateDeck,
} from '../src/meta.ts';
import { harmonyParts } from '../src/rules/harmony.ts';
import { checkExtinctions, setPopulation } from '../src/population.ts';
import type { GameState } from '../src/state.ts';
import { bare, data, dataWith, game, setPops, uidOf, zone } from './helpers.ts';

const BASE = data.meta.basePool;

/** Endzustand einer Partie, wie ihn recordGame bekommt. */
function finished(
  opts: { species?: Record<string, number>; round?: number; score?: number; extinct?: number; events?: number } = {},
): GameState {
  const s = bare(opts.round ?? 10);
  s.species = {};
  for (const [id, since] of Object.entries(opts.species ?? { plankton: 0, beetle: 0 }))
    s.species[id] = { since, extinct: null };
  s.score = opts.score ?? 0;
  s.extinctions = Array.from({ length: opts.extinct ?? 0 }, () => ({ species: 'deer', round: 3 }));
  s.eventsOccurred = opts.events ?? 0;
  s.phase = 'over';
  return s;
}

describe('Schöpfungsbuch (Konzept 10)', () => {
  it('ein neues Buch ist leer; der Pool ist der Grundpool', () => {
    const b = newBook();
    expect(b).toEqual({
      version: 1,
      games: 0,
      species: {},
      milestones: {},
      totals: { rounds: 0, extinctions: 0, events: 0 },
      best: { score: 0, rounds: 0, tier: 0 },
    });
    expect(new Set(cardPool(data, b))).toEqual(new Set(BASE));
    expect(cardPool(data, b)).not.toContain('ark');
  });

  it('recordGame trägt Arten mit erster Partie ein, summiert und merkt Bestwerte – das alte Buch bleibt unverändert', () => {
    const b0 = newBook();
    const u1 = recordGame(data, b0, finished({ species: { plankton: 0, beetle: 0, fish: 4 }, round: 12, score: 30 }));
    expect(b0).toEqual(newBook());
    expect(u1.discovered).toEqual(['plankton', 'beetle', 'fish']);
    expect(u1.book.species.fish).toEqual({ firstGame: 1, firstRound: 4 });
    expect(u1.book.games).toBe(1);
    expect(u1.book.best).toEqual({ score: 30, rounds: 12, tier: 2 });
    expect(u1.records).toEqual(['score', 'rounds', 'tier']);
    const u2 = recordGame(data, u1.book, finished({ species: { plankton: 0, frog: 7 }, round: 5, score: 50 }));
    expect(u2.discovered).toEqual(['frog']);
    expect(u2.book.species.plankton).toEqual({ firstGame: 1, firstRound: 0 });
    expect(u2.book.species.frog!.firstGame).toBe(2);
    expect(u2.book.totals.rounds).toBe(17);
    expect(u2.book.best).toEqual({ score: 50, rounds: 12, tier: 3 });
    expect(u2.records).toEqual(['score', 'tier']);
  });

  it('entdeckte Art ⇒ ihre Gabe kommt in den Kartenpool', () => {
    const u = recordGame(data, newBook(), finished({ species: { plankton: 0, raptor: 9 } }));
    expect(u.unlocked).toEqual(expect.arrayContaining(['algal_bloom', 'scout_eye']));
    expect(cardPool(data, u.book)).toEqual(expect.arrayContaining(['algal_bloom', 'scout_eye']));
    expect(cardPool(data, u.book)).not.toContain('decomposition');
  });

  it('Meilensteine schalten Wunder frei: Arche nach dem ersten Aussterben', () => {
    const none = recordGame(data, newBook(), finished({ round: 2 }));
    expect(none.milestones).toEqual([]);
    const u = recordGame(data, none.book, finished({ extinct: 1, round: 3 }));
    expect(u.milestones).toEqual(['first_extinction']);
    expect(u.book.milestones.first_extinction).toEqual({ game: 2 });
    expect(u.unlocked).toContain('ark');
    expect(cardPool(data, u.book)).toContain('ark');
    // Einmal erreicht, bleibt erreicht und wird nicht erneut gemeldet.
    const again = recordGame(data, u.book, finished({ extinct: 2, round: 3 }));
    expect(again.milestones).toEqual([]);
    expect(again.book.milestones.first_extinction).toEqual({ game: 2 });
  });

  it('Meilensteine über Summen: Stille nach 20 Ereignissen (über mehrere Partien)', () => {
    let b = newBook();
    b = recordGame(data, b, finished({ events: 12, round: 2 })).book;
    b = recordGame(data, b, finished({ events: 7, round: 2 })).book;
    expect(b.milestones.weathered).toBeUndefined();
    const u = recordGame(data, b, finished({ events: 1, round: 2 }));
    expect(u.milestones).toEqual(['weathered']);
    expect(u.unlocked).toEqual(['silence']);
  });

  it('bookStat liefert jede Kennzahl', () => {
    const b = recordGame(
      data,
      newBook(),
      finished({ species: { plankton: 0, frog: 2 }, round: 7, score: 9, extinct: 1, events: 2 }),
    ).book;
    expect(
      ['games', 'discovered', 'extinctions', 'events', 'rounds', 'bestScore', 'bestRounds', 'bestTier'].map((k) =>
        bookStat(b, k as Parameters<typeof bookStat>[1]),
      ),
    ).toEqual([1, 2, 1, 2, 7, 9, 7, 3]);
  });

  it('parseBook prüft geladene Bücher (bleibt zwischen Partien als JSON erhalten)', () => {
    const b = recordGame(data, newBook(), finished()).book;
    expect(parseBook(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(parseBook({ version: 2 })).toBeNull();
    expect(parseBook(null)).toBeNull();
  });

  it('dailySeed: Welt des Tages aus dem UTC-Datum', () => {
    expect(dailySeed(new Date(Date.UTC(2026, 10, 10, 23, 59)))).toBe('daily-2026-11-10');
    expect(dailySeed(new Date(Date.UTC(2027, 0, 2)))).toBe('daily-2027-01-02');
  });
});

describe('Startdeck (Konzept 6.2, 10)', () => {
  const deck = ['rain', 'rain', 'sun', 'sun', 'seeds', 'seeds', 'storm', 'storm'];

  it('validateDeck: 8–10 Karten, höchstens 2 Kopien, nur bekannte Karten und – mit Buch – nur der Pool', () => {
    expect(validateDeck(data, newBook(), deck)).toEqual([]);
    expect(validateDeck(data, newBook(), deck.slice(0, 7))).toEqual([{ code: 'size', count: 7, min: 8, max: 10 }]);
    expect(validateDeck(data, null, [...deck.slice(0, 7), 'rain'])).toEqual([
      { code: 'copies', card: 'rain', count: 3, max: 2 },
    ]);
    expect(validateDeck(data, null, [...deck.slice(0, 7), 'nope'])).toEqual([{ code: 'unknown', card: 'nope' }]);
    expect(validateDeck(data, newBook(), [...deck.slice(0, 7), 'ark'])).toEqual([{ code: 'locked', card: 'ark' }]);
    expect(validateDeck(data, null, [...deck.slice(0, 7), 'ark'])).toEqual([]);
    expect(validateDeck(data, newBook(), data.config.starterDeck)).toEqual([]);
  });

  it('deckIssueText beschreibt jedes Problem', () => {
    expect(deckIssueText({ code: 'size', count: 7, min: 8, max: 10 })).toMatch(/7 Karten, erlaubt 8–10/);
    expect(deckIssueText({ code: 'copies', card: 'rain', count: 3, max: 2 })).toMatch(/rain 3×/);
    expect(deckIssueText({ code: 'unknown', card: 'x' })).toMatch(/Unbekannte Karte/);
    expect(deckIssueText({ code: 'locked', card: 'ark' })).toMatch(/nicht freigeschaltet: ark/);
  });

  it('newGame prüft GameSetup.deck gegen das Buch', () => {
    const locked = [...deck.slice(0, 7), 'ark'];
    expect(() => newGame(data, { seed: 1, deck: locked, book: newBook() })).toThrow(/nicht freigeschaltet: ark/);
    const b = recordGame(data, newBook(), finished({ extinct: 1 })).book;
    const s = newGame(data, { seed: 1, deck: locked, book: b });
    expect([...s.hand, ...s.drawPile].map((c) => c.card)).toContain('ark');
  });
});

describe('Variierende Startwelten (Konzept 10)', () => {
  it('aus: Ruhewerte; an: deterministisch aus dem Seed, innerhalb ±spread und der Skala', () => {
    const plain = newGame(data, { seed: 's' });
    const a = newGame(data, { seed: 's', vary: true });
    const b = newGame(data, { seed: 's', vary: true });
    expect(a.zones).toEqual(b.zones);
    expect(a.hand).toEqual(plain.hand); // eigener Zufallsstrom: Deck unverändert
    const spread = data.config.startWorld.spread;
    let changed = 0;
    a.zones.forEach((z, i) => {
      for (const [stat, v] of Object.entries(z.stats)) {
        const base = plain.zones[i]!.stats[stat]!;
        expect(Math.abs(v - base)).toBeLessThanOrEqual(spread);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
        if (v !== base) changed++;
      }
    });
    expect(changed).toBeGreaterThan(0);
    const other = newGame(data, { seed: 't', vary: true });
    expect(other.zones.map((z) => z.stats)).not.toEqual(a.zones.map((z) => z.stats));
  });

  it('Standard aus config.startWorld.vary', () => {
    const d = dataWith((r) => (r.config.startWorld = { vary: true, spread: 2 }));
    expect(newGame(d, { seed: 's' }).zones).toEqual(newGame(d, { seed: 's', vary: true }).zones);
    expect(newGame(d, { seed: 's', vary: false }).zones.map((z) => z.stats)).toEqual(
      newGame(data, { seed: 's' }).zones.map((z) => z.stats),
    );
  });
});

describe('Aussterben und Neuentstehung in derselben Runde (Konzept 7)', () => {
  it('der Harmonie-Abzug gilt, auch wenn die Art in derselben Runde zurückkehrt', () => {
    const s = bare(3);
    setPops(s, 'forest', { deer: 1 });
    setPopulation(data, s, zone(s, 'forest'), 'deer', 0, () => {}, 'hunger');
    checkExtinctions(s, () => {});
    setPopulation(data, s, zone(s, 'plains'), 'deer', 2, () => {}, 'evolution'); // entsteht neu
    expect(s.species.deer!.extinct).toBeNull();
    expect(s.extinctions).toEqual([{ species: 'deer', round: 3 }]);
    expect(harmonyParts(data, s)).toContainEqual({ source: 'extinction:deer', zone: null, amount: -10 });
    s.round = 4;
    expect(harmonyParts(data, s).some((p) => p.source.startsWith('extinction'))).toBe(false);
  });
});

describe('Fassade für die App', () => {
  /** Gezielte Testkarte mit Zone und frei wählbarer Nachbarzone (wie der frühere gezielte Sturm). */
  const fell = dataWith((r) =>
    r.cards.cards.push({
      id: 'fell',
      name: { de: 'Fällen', en: 'Fell' },
      category: 'gift',
      cost: 1,
      slots: [
        { id: 'zone', kind: 'zone' },
        { id: 'fall', kind: 'neighbor', of: 'zone', label: { de: 'Fallrichtung', en: 'Direction of fall' } },
      ],
      effects: [{ adjust: 'vegetation', by: -1, at: 'fall' }],
    }),
  );

  it('slotOptions: Werte für den nächsten offenen Slot, nur vollständig belegbare', () => {
    const s = game({ d: fell, hand: ['fell', 'decomposition'] });
    const f = uidOf(s, 'fell');
    expect(slotOptions(fell, s, f, {})).toEqual(['mountains', 'forest', 'plains', 'river', 'coast']);
    expect(slotOptions(fell, s, f, { zone: 'coast' })).toEqual(['river', 'plains']); // Reihenfolge der Nachbarn
    expect(slotOptions(fell, s, f, { zone: 'coast', fall: 'river' })).toEqual([]);
    expect(slotOptions(fell, s, f, { zone: 'moon' })).toEqual([]);
    expect(slotOptions(fell, s, 999, {})).toEqual([]);
    // Zersetzung: nur der Wald hat Totholz, und nur mit Flachland nebenan.
    expect(slotOptions(fell, s, uidOf(s, 'decomposition'), {})).toEqual(['forest']);
  });

  it('CardView.slots nennt den bezogenen Slot (of)', () => {
    const s = game({ d: fell, hand: ['fell'] });
    expect(view(fell, s, 'de').hand[0]!.slots).toEqual([
      { id: 'zone', kind: 'zone', label: 'Zone' },
      { id: 'fall', kind: 'neighbor', label: 'Fallrichtung', of: 'zone' },
    ]);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tests verändern Rohdaten gezielt, auch ungültig.
type Loose = any;

describe('Datenprüfung Phase 3', () => {
  const problems = (patch: (r: Loose) => void): string => {
    try {
      dataWith(patch);
      return '';
    } catch (e) {
      return (e as Error).message;
    }
  };
  const ev = (r: Loose, id: string) => r.events.events.find((e: { id: string }) => e.id === id);

  it.each([
    [
      'Ereignis: Geografie',
      (r: Loose) => (ev(r, 'locusts').rules[0].geographies = ['moon']),
      /unbekannte Geografie moon/,
    ],
    [
      'Ereignis: Effektziel',
      (r: Loose) => (ev(r, 'heatwave').effects = [{ adjust: 'light', by: 1, at: 'target' }]),
      /Effektziel target/,
    ],
    ['Ereignis: Karte', (r: Loose) => (ev(r, 'lightning').card = 'nope'), /unbekannte Karte nope/],
    [
      'Ereignis: Karte mit zwei Slots',
      (r: Loose) => (ev(r, 'lightning').card = 'decomposition'),
      /genau einen Zonen-Slot/,
    ],
    ['Ereignis: Karte ohne Zufallsziel', (r: Loose) => (ev(r, 'plague').card = 'rain'), /target\.pick: random/],
    ['Ereignis doppelt', (r: Loose) => r.events.events.push(ev(r, 'heatwave')), /Ereignis doppelt: heatwave/],
    ['Meta: Grundpool', (r: Loose) => r.meta.basePool.push('nope'), /basePool: unbekannte Karte nope/],
    [
      'Meta: Freischaltung',
      (r: Loose) => r.meta.milestones[0].unlocks.push('nope'),
      /Meilenstein first_extinction: unbekannte Karte nope/,
    ],
    ['Startdeck außerhalb Grundpool', (r: Loose) => (r.config.starterDeck[0] = 'ark'), /ark ist nicht im Grundpool/],
    ['Startdeck Kopien', (r: Loose) => (r.config.starterDeck = Array(8).fill('rain')), /rain 8×, erlaubt 2/],
    [
      'Wahl-Option doppelt',
      (r: Loose) => {
        const c = r.cards.cards.find((x: { id: string }) => x.id === 'scout_eye');
        c.slots[0].options[1].id = 'avert';
      },
      /Option doppelt avert/,
    ],
    [
      'Wahl-Option Effekt',
      (r: Loose) => {
        const c = r.cards.cards.find((x: { id: string }) => x.id === 'scout_eye');
        c.slots[0].options[0].effects.push({ adjust: 'heat', by: 1 });
      },
      /unbekannter Wert heat/,
    ],
    ['Textbaustein log', (r: Loose) => delete r.config.texts['log.hunger'], /log\.hunger fehlt/],
  ])('meldet: %s', (_n, patch, expected) => {
    expect(problems(patch)).toMatch(expected);
  });

  it('Meilenstein-Kennzahl muss bekannt sein (Schema)', () => {
    expect(problems((r) => (r.meta.milestones[0].when = [{ stat: 'luck', gte: 1 }]))).toMatch(/meta\.yaml/);
  });
});
