import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { buildGameData, DataError, type RawData } from '../src/core/data.ts';
import { endExpedition } from '../src/core/engine.ts';
import { cardPool, emptyNotebook, recordExpedition, validateDeck } from '../src/core/meta.ts';
import { DEFAULT_DATA_DIR } from '../src/node/load.ts';
import { simulate } from '../src/sim/campaign.ts';
import { addAnimal, data, setup } from './helpers.ts';

function raw(): RawData {
  const read = (f: string) => parse(readFileSync(join(DEFAULT_DATA_DIR, f), 'utf8'));
  return {
    config: read('config.yaml'),
    cards: read('cards.yaml'),
    animals: read('animals.yaml'),
    zones: read('zones.yaml'),
    scenarios: read('scenarios.yaml'),
  };
}

describe('Datenprüfung', () => {
  it('meldet unbekannte Querverweise', () => {
    const r = raw() as { animals: { animals: { card: string; eats?: string[] }[] } } & RawData;
    r.animals.animals[0]!.card = 'gibtsnicht';
    expect(() => buildGameData(r)).toThrow(DataError);
  });

  it('meldet einseitige Nachbarschaft', () => {
    const r = raw() as { zones: { map: { zones: { neighbors: string[] }[] } } } & RawData;
    r.zones.map.zones[0]!.neighbors.push('c');
    expect(() => buildGameData(r)).toThrow(/nicht beidseitig/);
  });

  it('meldet Tippfehler in Bedingungen (Schema)', () => {
    const r = raw() as { animals: { animals: { conditions: unknown[] }[] } } & RawData;
    r.animals.animals[0]!.conditions = [{ stat: 'deadwood', gtee: 2 }];
    expect(() => buildGameData(r)).toThrow(DataError);
  });
});

describe('Notizbuch und Deck', () => {
  it('Startpool enthält nur Grundkräfte', () => {
    expect(cardPool(data, emptyNotebook()).sort()).toEqual(['drought', 'seeds', 'storm', 'thunderstorm']);
  });

  it('Dokumentierte Tiere schalten ihre Karte frei', () => {
    const nb = emptyNotebook();
    const s = setup();
    addAnimal(s, 'c', 'woodpecker');
    endExpedition(s);
    expect(recordExpedition(data, nb, s)).toEqual(['woodpecker']);
    expect(nb.entries.woodpecker).toEqual({ firstExpedition: 1, timesDocumented: 1 });
    expect(cardPool(data, nb)).toContain('tree_hollow');
  });

  it('Deckprüfung: Größe, Freischaltung, Kopien', () => {
    const nb = emptyNotebook();
    expect(validateDeck(data, nb, data.config.starterDeck)).toEqual([]);
    expect(validateDeck(data, nb, ['seeds'])).not.toEqual([]);
    expect(validateDeck(data, nb, [...data.config.starterDeck, 'tree_hollow'])).not.toEqual([]);
    expect(validateDeck(data, nb, [...data.config.starterDeck, 'seeds'])).not.toEqual([]);
  });
});

describe('Simulation', () => {
  it('läuft deterministisch mit beiden Bots', () => {
    for (const bot of ['random', 'greedy'] as const) {
      const opts = { bot, runs: 3, expeditions: 2, seed: 's', scenario: 'random' };
      const a = simulate(data, opts);
      expect(a.perExpedition).toHaveLength(2);
      expect(simulate(data, opts)).toEqual(a);
    }
  });
});
