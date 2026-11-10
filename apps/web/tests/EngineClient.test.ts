/** EngineClient: Partie, Aktionen, Fortsetzen, Verwerfen, Ablehnung und Meldungen – ohne DOM. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legalPlays, validateState, type GameEvent, type GameState } from '@being-god/core';
import { loadGameData } from '@being-god/core/node';
import { EngineClient } from '../src/client/EngineClient.ts';
import type { Notice } from '../src/client/GameClient.ts';
import { MemoryBookStore, MemorySaveStore } from '../src/client/SaveStore.ts';

const data = loadGameData();

function setup(store = new MemorySaveStore(), seed = 'test-seed') {
  const client = new EngineClient({ data, locale: 'de', store, seed });
  const notices: Notice[][] = [];
  client.subscribeNotices((n) => notices.push(n));
  return { client, store, notices };
}

/** Zugriff auf den aktuellen Engine-Zustand über den gespeicherten Stand (der Client speichert nach jedem Schritt). */
function savedState(store: MemorySaveStore): GameState {
  const saved = store.load();
  if (!saved) throw new Error('kein Spielstand gespeichert');
  return saved.state;
}

/** Die private Übersetzung Ereignisse → Meldungen, für konstruierte Ereignisfolgen. */
function toNotices(client: EngineClient, events: GameEvent[]): Notice[] {
  return (client as unknown as { toNotices(e: GameEvent[]): Notice[] }).toNotices(events);
}

describe('EngineClient', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('startet eine neue Partie und speichert sie', () => {
    const v = ctx.client.getView();
    expect(v.round).toBe(1);
    expect(v.phase).toBe('play');
    expect(v.zones.length).toBeGreaterThan(0);
    expect(v.hand.length).toBeGreaterThan(0);
    expect(ctx.store.load()?.seed).toBe('test-seed');
  });

  it('führt eine gültige Aktion aus, aktualisiert die View und meldet den Zug', () => {
    const play = legalPlays(data, savedState(ctx.store))[0];
    expect(play).toBeDefined();
    let changes = 0;
    ctx.client.subscribe(() => changes++);
    ctx.client.dispatch({ type: 'play', uid: play!.uid, targets: play!.targets });
    expect(changes).toBe(1);
    expect(ctx.client.getView().playsThisTurn).toBe(1);
    expect(ctx.client.getView().hand.some((c) => c.uid === play!.uid)).toBe(false);
    expect(ctx.notices.flat().some((n) => n.type === 'played')).toBe(true);
    expect(savedState(ctx.store).playsThisTurn).toBe(1);
  });

  it('meldet beim Rundenende die neue Runde', () => {
    const play = legalPlays(data, savedState(ctx.store))[0]!;
    ctx.client.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
    ctx.client.dispatch({ type: 'endTurn' });
    expect(ctx.client.getView().round).toBe(2);
    expect(ctx.notices.flat()).toContainEqual(expect.objectContaining({ type: 'round', round: 2 }));
  });

  it('setzt eine gespeicherte Partie fort', () => {
    const play = legalPlays(data, savedState(ctx.store))[0]!;
    ctx.client.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
    const resumed = new EngineClient({ data, locale: 'de', store: ctx.store, seed: 'anderer-seed' });
    expect(resumed.getView()).toEqual(ctx.client.getView());
    expect(ctx.store.load()?.seed).toBe('test-seed');
  });

  it('verwirft einen Spielstand, der nicht zu den Daten passt, und beginnt neu', () => {
    const store = new MemorySaveStore();
    const broken = structuredClone(savedState(ctx.store));
    broken.zones = broken.zones.map((z) => ({ ...z, geography: 'gibt-es-nicht' }));
    store.save({ version: 1, seed: 'kaputt', savedAt: 0, state: broken });
    const client = new EngineClient({ data, locale: 'de', store, seed: 'frisch' });
    expect(client.getView().round).toBe(1);
    expect(store.load()?.seed).toBe('frisch');
  });

  it('lässt den Zustand bei einer ungültigen Aktion unverändert und meldet „Zug nicht möglich“', () => {
    const before = ctx.client.getView();
    const saved = ctx.store.load();
    ctx.client.dispatch({ type: 'play', uid: 99999, targets: {} });
    expect(ctx.client.getView()).toBe(before);
    expect(ctx.store.load()).toEqual(saved);
    expect(ctx.notices).toEqual([[{ type: 'rejected' }]]);
  });

  it('lehnt Rundenende ohne Kartenzwang-Erfüllung ab (sofern eine Karte spielbar ist)', () => {
    if (ctx.client.getView().canEndTurn) return; // Kartenzwang greift nur bei spielbarer Karte
    ctx.client.dispatch({ type: 'endTurn' });
    expect(ctx.client.getView().round).toBe(1);
    expect(ctx.notices).toEqual([[{ type: 'rejected' }]]);
  });

  it('verwirft einen Spielstand mit unbekannten Karten beim Laden', () => {
    const store = new MemorySaveStore();
    const state = structuredClone(savedState(ctx.store));
    state.hand[0] = { ...state.hand[0]!, card: 'gibt-es-nicht' };
    store.save({ version: 1, seed: 'alt', savedAt: 0, state });
    const client = new EngineClient({ data, locale: 'de', store, seed: 'frisch' });
    expect(client.getView().hand.every((c) => c.card !== 'gibt-es-nicht')).toBe(true);
    expect(store.load()?.seed).toBe('frisch');
  });

  it('meldet „unpassend“, wenn der Zustand während der Partie nicht mehr zu den Daten passt', () => {
    const shifting = { ...data, cards: new Map(data.cards) };
    const store = new MemorySaveStore();
    const drifting = new EngineClient({ data: shifting, locale: 'de', store, seed: 'drift' });
    const local: Notice[][] = [];
    drifting.subscribeNotices((n) => local.push(n));
    const play = legalPlays(shifting, savedState(store))[0]!;
    shifting.cards.delete(savedState(store).hand.find((c) => c.uid === play.uid)!.card);
    drifting.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
    expect(local).toEqual([[{ type: 'incompatible' }]]);
  });

  it('prüft gespeicherte Stände mit validateState und meldet den Grund in der Konsole', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new MemorySaveStore();
    const broken = structuredClone(savedState(ctx.store));
    broken.harmony = -5; // Wertebereich – die frühere Id-Prüfung der App sah das nicht
    store.save({ version: 1, seed: 'kaputt', savedAt: 0, state: broken });
    const check = validateState(data, broken);
    expect(check.ok).toBe(false);
    const client = new EngineClient({ data, locale: 'de', store, seed: 'frisch' });
    expect(client.getView().harmony.value).toBeGreaterThan(0);
    expect(store.load()?.seed).toBe('frisch');
    const logged = warn.mock.calls.flat().map((x) => (x instanceof Error ? x.message : String(x)));
    expect(logged.some((x) => !check.ok && x.includes(check.reason))).toBe(true);
    warn.mockRestore();
  });

  it('nutzt einen festen Seed (?seed=) auch für „Neue Partie“', () => {
    const store = new MemorySaveStore();
    const client = new EngineClient({ data, locale: 'de', store, seed: 'fest' });
    const first = client.getView();
    const play = legalPlays(data, savedState(store))[0]!;
    client.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
    client.newGame();
    expect(store.load()?.seed).toBe('fest');
    expect(client.getView()).toEqual(first);
  });

  it('neue Partie setzt den Stand zurück', () => {
    const play = legalPlays(data, savedState(ctx.store))[0]!;
    ctx.client.dispatch({ type: 'play', uid: play.uid, targets: play.targets });
    ctx.client.newGame();
    expect(ctx.client.getView().playsThisTurn).toBe(0);
    expect(ctx.client.getView().round).toBe(1);
  });

  it('liefert Ziele und Artnamen für Slots', () => {
    const v = ctx.client.getView();
    const card = v.hand.find((c) => c.playable && c.slots[0]?.kind === 'zone');
    if (card) {
      const zones = ctx.client.legalTargets(card.uid, {});
      expect(zones.length).toBeGreaterThan(0);
      for (const z of zones) expect(v.zones.some((x) => x.id === z)).toBe(true);
    }
    expect(ctx.client.speciesName('deer')).toBe('Hirsch');
    expect(ctx.client.speciesName('unbekannt')).toBe('unbekannt');
  });
});

describe('Zielwahl über slotOptions', () => {
  it('liefert die Optionen eines Wahl-Slots (Späherblick) und Arten eines Art-Slots (Jagd)', () => {
    const store = new MemorySaveStore();
    setup(store, 'wahl');
    const state = savedState(store);
    const plains = state.zones.find((z) => z.geography === 'plains')!;
    plains.populations = { ...plains.populations, deer: 3 };
    state.hand[0] = { ...state.hand[0]!, card: 'scout_eye' };
    state.hand[1] = { ...state.hand[1]!, card: 'hunt' };
    store.save({ version: 1, seed: 'wahl', savedAt: 0, state });
    const client = new EngineClient({ data, locale: 'de', store, seed: 'wahl' });
    const scout = client.getView().hand[0]!;
    expect(scout.slots[0]?.kind).toBe('choice');
    expect(client.legalTargets(scout.uid, {}).sort()).toEqual(['avert', 'delay']);
    const hunt = client.getView().hand[1]!;
    expect(client.legalTargets(hunt.uid, {})).toContain(plains.id);
    expect(client.legalTargets(hunt.uid, { zone: plains.id })).toContain('deer');
    const p = client.preview(hunt.uid, { zone: plains.id, prey: 'deer' });
    expect(p?.populationChanges).toEqual([
      expect.objectContaining({ zone: plains.id, species: 'deer', speciesName: 'Hirsch', from: 3, to: 1 }),
    ]);
  });
});

describe('Schöpfungsbuch', () => {
  it('trägt eine beendete Partie ein, speichert das Buch und meldet Neues', () => {
    const books = new MemoryBookStore();
    const client = new EngineClient({ data, locale: 'de', store: new MemorySaveStore(), books, seed: 'buch' });
    expect(client.getBook().games).toBe(0);
    expect(client.lastResult()).toBeNull();
    (client as unknown as { record(): void }).record();
    expect(books.load()?.games).toBe(1);
    const book = client.getBook();
    expect(book.games).toBe(1);
    expect(book.species.length).toBeGreaterThan(0);
    expect(book.speciesTotal).toBe(data.species.size);
    expect(book.milestones.length).toBe(data.meta.milestones.length);
    expect(client.lastResult()?.discovered.length).toBe(book.species.length);
    client.newGame();
    expect(client.lastResult()).toBeNull();
    // Ein neuer Client liest das gespeicherte Buch
    const again = new EngineClient({ data, locale: 'de', store: new MemorySaveStore(), books, seed: 'buch2' });
    expect(again.getBook().games).toBe(1);
  });
});

describe('Ereignisse → Meldungen', () => {
  const { client } = setup();
  const zones = client.getView().zones;
  const forest = zones.find((z) => z.geography === 'forest')!;
  const plains = zones.find((z) => z.geography === 'plains')!;

  it('fasst Überweidung je Zone zusammen', () => {
    const notices = toNotices(client, [
      { type: 'overpopulation', zone: forest.id, food: 'vegetation' },
      { type: 'overpopulation', zone: forest.id, food: 'deer' },
      { type: 'overpopulation', zone: forest.id, food: 'vegetation' },
      { type: 'overpopulation', zone: plains.id, food: 'vegetation' },
    ]);
    const over = notices.filter((n) => n.type === 'overgrazed');
    expect(over).toEqual([
      { type: 'overgrazed', zone: forest.geographyName, foods: ['Vegetation', 'Hirsch'] },
      { type: 'overgrazed', zone: plains.geographyName, foods: ['Vegetation'] },
    ]);
  });

  it('fasst Jagd durch Menschen je Zone und Art zusammen', () => {
    const notices = toNotices(client, [
      { type: 'populationChanged', zone: plains.id, species: 'deer', from: 5, to: 4, cause: 'hunted' },
      { type: 'populationChanged', zone: plains.id, species: 'small_mammal', from: 3, to: 2, cause: 'hunted' },
      { type: 'populationChanged', zone: plains.id, species: 'deer', from: 4, to: 3, cause: 'hunted' },
      { type: 'populationChanged', zone: plains.id, species: 'deer', from: 3, to: 2, cause: 'hunger' },
    ]);
    expect(notices.filter((n) => n.type === 'hunted')).toEqual([
      {
        type: 'hunted',
        zone: plains.geographyName,
        losses: [
          { species: 'Hirsch', delta: -2 },
          { species: 'Kleinsäuger', delta: -1 },
        ],
      },
    ]);
  });

  it('fasst Bestandsänderungen durch Karten und ihre Schwellen je Zone zusammen', () => {
    const notices = toNotices(client, [
      { type: 'populationChanged', zone: forest.id, species: 'deer', from: 4, to: 2, cause: 'card:hunt' },
      { type: 'populationChanged', zone: forest.id, species: 'beetle', from: 1, to: 0, cause: 'trigger:hunt.x' },
      { type: 'populationChanged', zone: forest.id, species: 'bee', from: 1, to: 1, cause: 'card:hunt' },
    ]);
    expect(notices.filter((n) => n.type === 'populationShift')).toEqual([
      {
        type: 'populationShift',
        zone: forest.geographyName,
        card: 'Jagd',
        changes: [
          { species: 'Hirsch', delta: -2 },
          { species: 'Käfer', delta: -1 },
        ],
      },
    ]);
  });

  it('stellt Kollaps vor Rundenbeginn', () => {
    const notices = toNotices(client, [
      { type: 'roundStarted', round: 3, season: 'summer' },
      { type: 'collapsed', round: 3 },
    ]);
    expect(notices[0]).toEqual({ type: 'collapsed' });
    expect(notices[1]).toEqual(expect.objectContaining({ type: 'round', round: 3 }));
  });
});
