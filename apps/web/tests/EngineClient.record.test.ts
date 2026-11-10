/** Kollaps über dispatch: Das Schöpfungsbuch wird genau einmal eingetragen – auch nach weiteren Aktionen und beim Fortsetzen. */
import { expect, it, vi } from 'vitest';
import { canEndTurn, legalPlays, newGame, step, type GameState } from '@being-god/core';
import { loadGameData } from '@being-god/core/node';
import { EngineClient } from '../src/client/EngineClient.ts';
import { MemoryBookStore, MemorySaveStore } from '../src/client/SaveStore.ts';

const data = loadGameData();

/** Spielt mit zerstörerischen Zügen, bis die Welt kollabiert, und liefert den Zustand eine Runde davor. */
function stateBeforeCollapse(seed: string): GameState {
  let s: GameState = newGame(data, { seed });
  let before: GameState | null = null;
  for (let i = 0; i < 400 && s.phase === 'play'; i++) {
    const plays = legalPlays(data, s);
    const last = plays[plays.length - 1];
    if ((canEndTurn(data, s) && s.playsThisTurn >= data.config.turn.minPlays) || !last) {
      before = s;
      s = step(data, s, { type: 'endTurn' }).state;
    } else {
      s = step(data, s, { type: 'play', uid: last.uid, targets: last.targets }).state;
    }
  }
  if (s.phase !== 'over' || !before) throw new Error('Kein Kollaps erreicht');
  return before;
}

it('trägt die Partie nach dem Kollaps genau einmal ins Schöpfungsbuch ein', () => {
  const before = stateBeforeCollapse('x');
  const books = new MemoryBookStore();
  let saves = 0;
  const save = books.save.bind(books);
  books.save = (b) => {
    saves++;
    save(b);
  };
  const store = new MemorySaveStore();
  store.save({ version: 1, seed: 'x', savedAt: 0, state: before });

  const client = new EngineClient({ data, locale: 'de', store, books, seed: 'x' });
  client.dispatch({ type: 'endTurn' });
  expect(client.getView().phase).toBe('over');
  expect(saves).toBe(1);
  expect(client.lastResult()).not.toBeNull();

  client.dispatch({ type: 'endTurn' }); // nach dem Ende wirkungslos
  expect(saves).toBe(1);

  const resumed = new EngineClient({ data, locale: 'de', store, books, seed: 'x' });
  expect(resumed.getView().phase).toBe('over');
  expect(resumed.getBook().games).toBe(1);
  expect(saves).toBe(1);
});

it('nimmt das Engine-Ereignis gameOver als Auslöser: letztes Ereignis des Kollaps-Schritts, keine eigene Meldung', () => {
  const before = stateBeforeCollapse('x');
  const { events } = step(data, before, { type: 'endTurn' });
  expect(events.at(-1)).toMatchObject({ type: 'gameOver' });
  expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);

  const store = new MemorySaveStore();
  store.save({ version: 1, seed: 'x', savedAt: 0, state: before });
  const books = new MemoryBookStore();
  const client = new EngineClient({ data, locale: 'de', store, books, seed: 'x' });
  const notices = vi.fn();
  client.subscribeNotices(notices);
  client.dispatch({ type: 'endTurn' });
  expect(books.load()?.games).toBe(1);
  // gameOver selbst erzeugt keine Meldung; der Kollaps steht vorn
  expect(notices.mock.calls[0]?.[0]?.[0]).toEqual({ type: 'collapsed' });
});

it('trägt ohne gameOver-Ereignis nichts ein (gewöhnliche Runde)', () => {
  const books = new MemoryBookStore();
  const store = new MemorySaveStore();
  const client = new EngineClient({ data, locale: 'de', store, books, seed: 'y' });
  const s = store.load()!.state;
  const play = legalPlays(data, s)[0]!;
  client.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
  client.dispatch({ type: 'endTurn' });
  expect(client.getView().phase).toBe('play');
  expect(books.load()).toBeNull();
  expect(client.lastResult()).toBeNull();
});
