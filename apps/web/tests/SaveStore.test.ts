/** SaveStore: flüchtige und localStorage-Ablage – ohne DOM, mit einfachem Stub. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newGame, STATE_VERSION } from '@being-god/core';
import { loadGameData } from '@being-god/core/node';
import { LocalSaveStore, MemorySaveStore, type SavedGame } from '../src/client/SaveStore.ts';

const data = loadGameData();
const game = (): SavedGame => ({ version: 1, seed: 's', savedAt: 1, state: newGame(data, { seed: 's' }) });

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
    expect(store.load()).toBeNull();
    const g = game();
    store.save(g);
    const loaded = store.load();
    expect(loaded).toEqual(g);
    expect(loaded).not.toBe(g);
    loaded!.state.round = 99;
    expect(store.load()!.state.round).toBe(g.state.round);
    store.clear();
    expect(store.load()).toBeNull();
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

  it('speichert, lädt und löscht über localStorage', () => {
    const store = new LocalSaveStore('test.key');
    expect(store.load()).toBeNull();
    store.save(game());
    expect(storage.items.has('test.key')).toBe(true);
    expect(store.load()).toEqual(game());
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('verwirft fremde Formate und andere Zustandsversionen', () => {
    const store = new LocalSaveStore('k');
    storage.items.set('k', 'kein json');
    expect(store.load()).toBeNull();
    storage.items.set('k', JSON.stringify({ version: 2, seed: 's', state: {} }));
    expect(store.load()).toBeNull();
    const old = game();
    storage.items.set('k', JSON.stringify({ ...old, state: { ...old.state, version: STATE_VERSION - 1 } }));
    expect(store.load()).toBeNull();
  });

  it('wirft nie, auch wenn der Speicher gesperrt ist', () => {
    const store = new LocalSaveStore('k');
    storage.failing = true;
    expect(() => store.save(game())).not.toThrow();
    expect(store.load()).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });
});
