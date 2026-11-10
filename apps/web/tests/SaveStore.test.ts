/** SaveStore: flüchtige und localStorage-Ablage, alter Spielstand (Konzept 0.4) – ohne DOM, mit einfachem Stub. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import {
  LEGACY_KEYS,
  LocalSaveStore,
  MemorySaveStore,
  parseSaved,
  SAVE_KEY,
  type SavedGame,
} from '../src/client/SaveStore.ts';

const data = loadData();
const game = (): SavedGame => ({
  version: 2,
  seed: 's',
  savedAt: 1,
  state: newGame(data, { seed: 's' }),
  log: [{ month: 0, text: 'Hallo', tone: 'info' }],
});

class StorageStub {
  readonly items = new Map<string, string>();
  failing = false;
  getItem(key: string): string | null {
    if (this.failing) throw new Error('blockiert');
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failing) throw new Error('voll');
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    if (this.failing) throw new Error('blockiert');
    this.items.delete(key);
  }
}

describe('MemorySaveStore', () => {
  it('speichert Kopien und kann geleert werden', () => {
    const store = new MemorySaveStore();
    expect(store.load()).toEqual({ kind: 'none' });
    const g = game();
    store.save(g);
    const loaded = store.load();
    expect(loaded).toEqual({ kind: 'game', game: g });
    if (loaded.kind !== 'game') throw new Error('kein Stand');
    loaded.game.state.month = 99;
    const again = store.load();
    expect(again.kind === 'game' && again.game.state.month).toBe(0);
    store.clear();
    expect(store.load()).toEqual({ kind: 'none' });
  });

  it('meldet einen vorgegebenen Anfangszustand (z. B. alter Stand)', () => {
    expect(new MemorySaveStore({ kind: 'legacy' }).load()).toEqual({ kind: 'legacy' });
  });
});

describe('parseSaved', () => {
  it('liest die Hülle und filtert kaputte Protokoll-Einträge', () => {
    const g = game();
    const raw = JSON.stringify({ ...g, log: [...g.log, { text: 1 }, null] });
    expect(parseSaved(raw)).toEqual(g);
  });

  it('lehnt fremde Formate ab', () => {
    expect(parseSaved('kein json')).toBeNull();
    expect(parseSaved('null')).toBeNull();
    expect(parseSaved(JSON.stringify({ ...game(), version: 1 }))).toBeNull();
    expect(parseSaved(JSON.stringify({ ...game(), seed: 3 }))).toBeNull();
    expect(parseSaved(JSON.stringify({ ...game(), state: null }))).toBeNull();
  });

  it('übernimmt einen Stand ohne Protokoll', () => {
    const { log: _log, ...rest } = game();
    expect(parseSaved(JSON.stringify(rest))?.log).toEqual([]);
  });
});

describe('LocalSaveStore', () => {
  let storage: StorageStub;
  const g = globalThis as unknown as { window?: unknown };
  let previous: unknown;

  beforeEach(() => {
    storage = new StorageStub();
    previous = g.window;
    g.window = { localStorage: storage };
  });
  afterEach(() => {
    g.window = previous;
  });

  it('speichert und lädt einen Spielstand unter dem neuen Schlüssel', () => {
    const store = new LocalSaveStore();
    expect(store.load()).toEqual({ kind: 'none' });
    store.save(game());
    expect(storage.items.has(SAVE_KEY)).toBe(true);
    expect(store.load()).toEqual({ kind: 'game', game: game() });
    store.clear();
    expect(store.load()).toEqual({ kind: 'none' });
  });

  it('verwirft einen alten Spielstand (Konzept 0.4) samt Buch und Deck und meldet ihn einmal', () => {
    storage.setItem('being-god.save.v1', JSON.stringify({ version: 1, seed: 'x', state: { round: 3 } }));
    storage.setItem('being-god.book.v1', '{}');
    storage.setItem('being-god.deck.v1', '[]');
    const store = new LocalSaveStore();
    expect(store.load()).toEqual({ kind: 'legacy' });
    for (const key of LEGACY_KEYS) expect(storage.items.has(key)).toBe(false);
    expect(store.load()).toEqual({ kind: 'none' });
  });

  it('bevorzugt einen neuen Stand, räumt aber die alten Schlüssel auf', () => {
    storage.setItem('being-god.save.v1', '{}');
    const store = new LocalSaveStore();
    store.save(game());
    expect(store.load().kind).toBe('game');
    expect(storage.items.has('being-god.save.v1')).toBe(false);
  });

  it('meldet einen unlesbaren Stand als kaputt und entfernt ihn', () => {
    storage.setItem(SAVE_KEY, '{kaputt');
    const store = new LocalSaveStore();
    expect(store.load()).toEqual({ kind: 'broken' });
    expect(storage.items.has(SAVE_KEY)).toBe(false);
  });

  it('wirft nie, auch wenn der Speicher blockiert ist', () => {
    const store = new LocalSaveStore();
    storage.failing = true;
    expect(store.load()).toEqual({ kind: 'none' });
    expect(() => store.save(game())).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
