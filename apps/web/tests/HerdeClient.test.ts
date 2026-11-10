/** HerdeClient: Zustand, Schritte, Meldungen, Speichern und Prüfen gespeicherter Stände – ohne DOM. */
import { describe, expect, it, vi } from 'vitest';
import { newGame, view } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import { HerdeClient, LOG_MAX } from '../src/client/HerdeClient.ts';
import type { StepReport } from '../src/client/GameClient.ts';
import { MemorySaveStore, type LoadResult } from '../src/client/SaveStore.ts';
import { loadGameData } from '../src/client/gameData.ts';
import { de } from '../src/i18n/de.ts';
import { en } from '../src/i18n/en.ts';

const data = loadData();

function client(opts: { store?: MemorySaveStore; seed?: string; initial?: LoadResult } = {}) {
  const store = opts.store ?? new MemorySaveStore(opts.initial);
  let n = 0;
  return {
    store,
    client: new HerdeClient({
      data,
      locale: 'de',
      strings: de,
      store,
      seed: opts.seed,
      randomSeed: () => `zufall-${++n}`,
    }),
  };
}

/** Erster gültiger Kartenzug mit Ziel (oder global). */
function firstPlay(c: HerdeClient) {
  const card = c.getView().hand.find((h) => h.global || h.targets.length > 0)!;
  const target = card.targets[0];
  return card.global
    ? ({ type: 'play', hand: card.index } as const)
    : ({ type: 'play', hand: card.index, x: target!.x, y: target!.y } as const);
}

describe('Spieldaten im Browser', () => {
  it('baut dieselben Daten aus den eingebundenen YAML-Texten wie die Node-Ladefunktion', () => {
    const browser = loadGameData();
    expect([...browser.cards.keys()]).toEqual([...data.cards.keys()]);
    expect(view(browser, newGame(browser, { seed: 1 }))).toEqual(view(data, newGame(data, { seed: 1 })));
    expect(loadGameData()).toBe(browser);
  });
});

describe('HerdeClient', () => {
  it('startet eine neue Partie mit eigenem Seed und speichert sie', () => {
    const { client: c, store } = client();
    expect(c.getSeed()).toBe('zufall-1');
    expect(c.getView()).toEqual(view(data, newGame(data, { seed: 'zufall-1' })));
    expect(c.getView()).toBe(c.getView());
    const saved = store.load();
    expect(saved.kind === 'game' && saved.game.seed).toBe('zufall-1');
    expect(c.takeStartupNotice()).toBeNull();
  });

  it('nimmt einen festen Seed für jede Partie', () => {
    const { client: c } = client({ seed: 'fest' });
    expect(c.getSeed()).toBe('fest');
    c.newGame();
    expect(c.getSeed()).toBe('fest');
  });

  it('führt Züge über step aus, meldet sie und schreibt das Protokoll', () => {
    const { client: c, store } = client({ seed: 'zug' });
    const reports: StepReport[] = [];
    const changed = vi.fn();
    c.subscribeReports((r) => reports.push(r));
    c.subscribe(changed);
    const before = c.getView();
    const play = firstPlay(c);
    expect(c.dispatch(play)).toBe(true);
    expect(c.getView()).not.toBe(before);
    expect(c.getView().hand.length).toBe(before.hand.length - 1);
    expect(c.getView().wild.value).toBeGreaterThan(before.wild.value);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(reports[0]!.action).toBe('play');
    expect(reports[0]!.notices.length).toBeGreaterThan(0);

    expect(c.dispatch({ type: 'advance' })).toBe(true);
    expect(c.getView().month).toBe(1);
    expect(reports[1]!.notices.some((n) => n.text.startsWith('Die Herde'))).toBe(true);
    // neueste Einträge oben
    expect(c.getLog()[0]!.month).toBe(0);
    const saved = store.load();
    expect(saved.kind === 'game' && saved.game.state.month).toBe(1);
  });

  it('lehnt ungültige Züge ab, ohne den Zustand zu ändern', () => {
    const { client: c } = client();
    const reports: StepReport[] = [];
    c.subscribeReports((r) => reports.push(r));
    const before = c.getView();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(c.dispatch({ type: 'play', hand: 99 })).toBe(false);
    warn.mockRestore();
    expect(c.getView()).toBe(before);
    expect(reports[0]!.notices[0]!.text).toBe(de.evRejected);
  });

  it('Regen meldet die Felder, deren Futter gewachsen ist', () => {
    const state = newGame(data, { seed: 'regen' });
    state.hand = ['rain'];
    for (const cell of state.cells) cell.food = 0;
    const store = new MemorySaveStore();
    store.save({ version: 2, seed: 'regen', savedAt: 0, state, log: [] });
    const { client: c } = client({ store });
    const reports: StepReport[] = [];
    c.subscribeReports((r) => reports.push(r));
    const before = c.getView();
    expect(c.dispatch({ type: 'play', hand: 0 })).toBe(true);
    const after = c.getView();
    const rain = reports[0]!.fx.find((f) => f.type === 'rain');
    const want = after.cells.filter((cell, i) => cell.food > before.cells[i]!.food).map(({ x, y }) => ({ x, y }));
    expect(want.length).toBeGreaterThan(0);
    expect(rain).toEqual({ type: 'rain', cells: want });
  });

  it('setzt einen gespeicherten Stand fort', () => {
    const store = new MemorySaveStore();
    const first = client({ store, seed: 'weiter' }).client;
    first.dispatch({ type: 'advance' });
    first.dispatch({ type: 'advance' });
    const second = client({ store }).client;
    expect(second.getSeed()).toBe('weiter');
    expect(second.getView()).toEqual(first.getView());
    expect(second.getLog()).toEqual(first.getLog());
  });

  it('verwirft einen Stand, der laut validateState nicht passt, und meldet es einmal', () => {
    const state = newGame(data, { seed: 1 });
    state.hand.push('gibt_es_nicht');
    const store = new MemorySaveStore();
    store.save({ version: 2, seed: 'alt', savedAt: 0, state, log: [] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client: c } = client({ store });
    warn.mockRestore();
    expect(c.getSeed()).toBe('zufall-1');
    expect(c.takeStartupNotice()).toBe('incompatible');
    expect(c.takeStartupNotice()).toBeNull();
  });

  it('meldet einen verworfenen alten Spielstand (Konzept 0.4) bzw. einen kaputten', () => {
    expect(client({ initial: { kind: 'legacy' } }).client.takeStartupNotice()).toBe('legacy');
    expect(client({ initial: { kind: 'broken' } }).client.takeStartupNotice()).toBe('incompatible');
  });

  it('neue Partie leert Protokoll und meldet die Änderung', () => {
    const { client: c } = client();
    c.dispatch({ type: 'advance' });
    const changed = vi.fn();
    c.subscribe(changed);
    c.newGame();
    expect(c.getLog()).toEqual([]);
    expect(c.getView().month).toBe(0);
    expect(c.getSeed()).toBe('zufall-2');
    expect(changed).toHaveBeenCalled();
  });

  it('begrenzt das Protokoll und lässt sich abmelden', () => {
    const { client: c } = client({ seed: 'lang' });
    const listener = vi.fn();
    const off = c.subscribeReports(listener);
    off();
    for (let i = 0; i < 60 && !c.getView().over; i++) c.dispatch({ type: 'advance' });
    expect(listener).not.toHaveBeenCalled();
    expect(c.getLog().length).toBeLessThanOrEqual(LOG_MAX);
  });

  it('Vorschau ändert den Zustand nicht', () => {
    const { client: c } = client({ seed: 'vorschau' });
    const before = c.getView();
    const p = c.preview(firstPlay(c));
    expect(p).not.toBeNull();
    expect(c.getView()).toBe(before);
    expect(c.preview({ type: 'advance' })).toBeNull();
  });

  it('spricht auch Englisch', () => {
    const c = new HerdeClient({ data, locale: 'en', strings: en, store: new MemorySaveStore(), seed: 'en' });
    const reports: StepReport[] = [];
    c.subscribeReports((r) => reports.push(r));
    c.dispatch({ type: 'advance' });
    expect(reports[0]!.notices.some((n) => n.text.startsWith('The herd'))).toBe(true);
  });
});
