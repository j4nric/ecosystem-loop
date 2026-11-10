/** Startdeck-Auswahl: reine Deck-Logik, Texte zu Problemen, Ablage und die Anbindung an die Engine. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newBook, validateDeck, type DeckIssue } from '@being-god/core';
import { loadGameData } from '@being-god/core/node';
import { LocalDeckStore, MemoryDeckStore } from '../src/client/DeckStore.ts';
import { EngineClient } from '../src/client/EngineClient.ts';
import { MemorySaveStore } from '../src/client/SaveStore.ts';
import { de } from '../src/i18n/de.ts';
import { en } from '../src/i18n/en.ts';
import {
  addCard,
  canAdd,
  copies,
  deckIssueMessage,
  initialDeck,
  parseStoredDeck,
  removeCard,
  sameDeck,
  sortDeck,
} from '../src/logic/deck.ts';

const data = loadGameData();
const rules = { min: 8, max: 10, maxCopies: 2 };
/** Gültiges eigenes Deck aus dem Grundpool (8 Karten, eine doppelt). */
const CUSTOM = ['thunderstorm', 'drought', 'storm', 'frost', 'sun', 'seeds', 'balance', 'balance'];

describe('Deck-Logik', () => {
  it('fügt hinzu bis zur Kopien-Grenze und zur Höchstgröße', () => {
    let deck: readonly string[] = [];
    deck = addCard(deck, 'rain', rules);
    deck = addCard(deck, 'rain', rules);
    expect(copies(deck, 'rain')).toBe(2);
    expect(canAdd(deck, 'rain', rules)).toBe(false);
    expect(addCard(deck, 'rain', rules)).toBe(deck); // unverändert, gleiche Referenz
    const full = Array.from({ length: 10 }, (_, i) => `c${i}`);
    expect(canAdd(full, 'neu', rules)).toBe(false);
    expect(addCard(full, 'neu', rules)).toBe(full);
  });

  it('entfernt genau eine Kopie und lässt fehlende Karten unverändert', () => {
    const deck = ['sun', 'rain', 'sun'];
    expect(removeCard(deck, 'sun')).toEqual(['sun', 'rain']);
    expect(removeCard(deck, 'frost')).toBe(deck);
  });

  it('sortiert nach Pool-Reihenfolge und vergleicht unabhängig von der Reihenfolge', () => {
    expect(sortDeck(['c', 'x', 'a', 'c'], ['a', 'b', 'c'])).toEqual(['a', 'c', 'c', 'x']);
    expect(sameDeck(['a', 'b', 'b'], ['b', 'a', 'b'])).toBe(true);
    expect(sameDeck(['a', 'b'], ['a', 'b', 'b'])).toBe(false);
    expect(sameDeck(['a', 'a'], ['a', 'b'])).toBe(false);
  });

  it('liest gespeicherte Decks nur als Liste von Texten', () => {
    expect(parseStoredDeck(['rain', 'sun'])).toEqual(['rain', 'sun']);
    expect(parseStoredDeck('rain')).toBeNull();
    expect(parseStoredDeck([])).toBeNull();
    expect(parseStoredDeck(['rain', 3])).toBeNull();
    expect(parseStoredDeck(['rain', ''])).toBeNull();
    expect(parseStoredDeck(Array.from({ length: 41 }, () => 'rain'))).toBeNull();
  });

  it('beginnt mit dem gemerkten Deck, wenn die Engine es akzeptiert, sonst mit dem Standarddeck', () => {
    const book = newBook();
    const issues = (d: string[]) => validateDeck(data, book, d);
    const standard = data.config.starterDeck;
    const custom = [...CUSTOM];
    expect(issues(custom)).toEqual([]);
    expect(initialDeck(custom, standard, issues)).toEqual(custom);
    expect(initialDeck(null, standard, issues)).toEqual([...standard]);
    expect(initialDeck(['rain'], standard, issues)).toEqual([...standard]); // zu klein
    expect(initialDeck([...standard.slice(0, 8), 'gibt-es-nicht'], standard, issues)).toEqual([...standard]);
  });
});

describe('Deck-Probleme als Text', () => {
  const names = (id: string) => (id === 'rain' ? 'Regen' : id);
  const all: DeckIssue[] = [
    { code: 'size', count: 7, min: 8, max: 10 },
    { code: 'copies', card: 'rain', count: 3, max: 2 },
    { code: 'unknown', card: 'xyz' },
    { code: 'locked', card: 'rain' },
  ];

  it('nennt Karten mit Namen statt Ids – deutsch und englisch', () => {
    expect(all.map((i) => deckIssueMessage(i, de, names))).toEqual([
      'Das Deck hat 7 Karten – erlaubt sind 8–10.',
      'Regen ist 3× im Deck – höchstens 2×.',
      'Unbekannte Karte: xyz.',
      'Regen ist noch nicht freigeschaltet.',
    ]);
    for (const issue of all) expect(deckIssueMessage(issue, en, names)).not.toBe('');
    expect(deckIssueMessage(all[0]!, en, names)).toBe('The deck has 7 cards – 8–10 allowed.');
  });

  it('formuliert jede Engine-Meldung für ein zu großes Deck mit Kopien-Überschuss', () => {
    const deck = [...data.config.starterDeck, 'rain', 'rain'];
    const issues = validateDeck(data, newBook(), deck);
    expect(issues.map((i) => i.code).sort()).toEqual(['copies', 'size']);
    const texts = issues.map((i) => deckIssueMessage(i, de, (id) => data.cards.get(id)?.name.de ?? id));
    expect(texts.some((x) => x.includes('Regen') || x.includes(data.cards.get('rain')!.name.de))).toBe(true);
  });
});

describe('DeckStore', () => {
  const g = globalThis as unknown as { window?: unknown };
  let previous: unknown;
  let items: Map<string, string>;
  let failing: boolean;

  beforeEach(() => {
    items = new Map();
    failing = false;
    previous = g.window;
    g.window = {
      localStorage: {
        getItem: (k: string) => {
          if (failing) throw new Error('blockiert');
          return items.get(k) ?? null;
        },
        setItem: (k: string, v: string) => {
          if (failing) throw new Error('voll');
          items.set(k, v);
        },
      },
    };
  });
  afterEach(() => {
    g.window = previous;
  });

  it('merkt sich das Deck in localStorage und verwirft Unsinn', () => {
    const store = new LocalDeckStore('d');
    expect(store.load()).toBeNull();
    store.save(['rain', 'sun']);
    expect(store.load()).toEqual(['rain', 'sun']);
    items.set('d', '{"kaputt":');
    expect(store.load()).toBeNull();
    items.set('d', '{"a":1}');
    expect(store.load()).toBeNull();
  });

  it('wirft nie, auch wenn der Speicher gesperrt ist', () => {
    const store = new LocalDeckStore('d');
    failing = true;
    expect(() => store.save(['rain'])).not.toThrow();
    expect(store.load()).toBeNull();
  });

  it('flüchtige Ablage liefert Kopien', () => {
    const store = new MemoryDeckStore();
    const deck = ['rain'];
    store.save(deck);
    deck.push('sun');
    expect(store.load()).toEqual(['rain']);
  });
});

describe('EngineClient: Startdeck', () => {
  it('liefert Pool, Standarddeck und Regeln aus den Daten', () => {
    const client = new EngineClient({ data, locale: 'en', store: new MemorySaveStore(), seed: 's' });
    const setup = client.deckSetup();
    expect(setup.standard).toEqual(data.config.starterDeck);
    expect(setup.rules).toEqual({
      min: data.config.deck.minSize,
      max: data.config.deck.maxSize,
      maxCopies: data.config.deck.maxCopies,
    });
    expect(setup.pool.map((c) => c.id)).toEqual(expect.arrayContaining([...data.meta.basePool]));
    for (const card of setup.pool) {
      expect(card.name).toBe(data.cards.get(card.id)!.name.en);
      expect(card.text.length).toBeGreaterThan(0);
      expect(card.short.length).toBeGreaterThan(0);
    }
    expect(client.checkDeck(setup.standard)).toEqual([]);
    expect(client.checkDeck(['rain'])).toContainEqual(expect.objectContaining({ code: 'size' }));
  });

  it('startet eine neue Partie mit dem gewählten Deck', () => {
    const store = new MemorySaveStore();
    const client = new EngineClient({ data, locale: 'de', store, seed: 's' });
    const deck = [...CUSTOM];
    client.newGame(deck);
    const s = store.load()!.state;
    const cards = [...s.hand, ...s.drawPile, ...s.discardPile].map((c) => c.card);
    // Dazu kommen Gaben der Startarten; vom Standarddeck bleibt nur, was im eigenen Deck steht.
    expect(cards).toEqual(expect.arrayContaining(deck));
    expect(cards.filter((c) => c === 'balance')).toHaveLength(2);
    expect(cards).not.toContain('rain');
  });

  it('nimmt beim Start das gemerkte Deck, bei einem ungültigen das Standarddeck', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deck = [...CUSTOM];
    const store = new MemorySaveStore();
    new EngineClient({ data, locale: 'de', store, seed: 's', deck });
    const all = (st: MemorySaveStore) => {
      const s = st.load()!.state;
      return [...s.hand, ...s.drawPile, ...s.discardPile].map((c) => c.card).sort();
    };
    expect(all(store).filter((c) => c === 'balance')).toHaveLength(2);
    expect(all(store)).not.toContain('rain');

    const other = new MemorySaveStore();
    const client = new EngineClient({ data, locale: 'de', store: other, seed: 's', deck: ['rain'] });
    expect(all(other)).toEqual(expect.arrayContaining([...data.config.starterDeck]));
    expect(all(other)).not.toContain('balance');
    client.newGame(['balance', 'balance', 'balance']);
    expect(all(other)).toEqual(expect.arrayContaining([...data.config.starterDeck]));
    expect(all(other)).not.toContain('balance');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
