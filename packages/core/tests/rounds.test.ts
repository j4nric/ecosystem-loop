/** Konzept 3 und 6.2: Rundenablauf, Kartenzwang, Hand und Stapel, Reinheit, Determinismus. */
import { describe, expect, it } from 'vitest';
import { canEndTurn, legalPlays, newGame, step } from '../src/game.ts';
import type { GameEvent } from '../src/state.ts';
import { RuleError } from '../src/world.ts';
import { data, dataWith, endTurn, game, play, setStats } from './helpers.ts';

describe('Partie-Aufbau', () => {
  it('startet in Runde 1 (Frühling, Jahr 1) mit Harmonie 60, Startodem und 4 Handkarten', () => {
    const s = newGame(data, { seed: 1 });
    expect(s.round).toBe(1);
    expect(s.phase).toBe('play');
    expect(s.harmony).toBe(60);
    expect(s.breath).toBe(3);
    expect(s.hand).toHaveLength(4);
    // Startdeck plus die Gaben des Startlebens (Algenblüte, Zersetzung)
    expect(s.hand.length + s.drawPile.length).toBe(data.config.starterDeck.length + 2);
    expect([...s.hand, ...s.drawPile].map((c) => c.card)).toEqual(
      expect.arrayContaining(['algal_bloom', 'decomposition']),
    );
    expect(s.zones.map((z) => z.id)).toEqual(['mountains', 'forest', 'plains', 'river', 'coast']);
    expect(s.zones.every((z) => z.level === 1)).toBe(true);
  });

  it('jede Zone hat die drei gemeinsamen Werte und den Sonderwert ihrer Geografie, auf Ruhewert', () => {
    const s = newGame(data, { seed: 1 });
    for (const z of s.zones) {
      const g = data.geographies.get(z.geography)!;
      expect(Object.keys(z.stats).sort()).toEqual(['light', 'moisture', 'vegetation', g.special].sort());
      expect(z.stats).toEqual(g.rest);
    }
  });

  it('Nachbarschaft wie Konzept 4: der Fluss grenzt an alle anderen', () => {
    const s = newGame(data, { seed: 1 });
    const n = Object.fromEntries(s.zones.map((z) => [z.id, [...z.neighbors].sort()]));
    expect(n.river).toEqual(['coast', 'forest', 'mountains', 'plains']);
    expect(n.mountains).toEqual(['forest', 'river']);
    expect(n.forest).toEqual(['mountains', 'plains', 'river']);
    expect(n.plains).toEqual(['coast', 'forest', 'river']);
    expect(n.coast).toEqual(['plains', 'river']);
  });

  it('Szenarien verändern Startwerte, Harmonie und Odem', () => {
    const dry = newGame(data, { seed: 1, scenario: 'drought' });
    expect(dry.zones.find((z) => z.id === 'forest')!.stats.moisture).toBe(1);
    expect(dry.zones.find((z) => z.id === 'river')!.stats.water).toBe(1);
    expect(dry.zones.find((z) => z.id === 'mountains')!.stats.moisture).toBe(0);
    const fragile = newGame(data, { seed: 1, scenario: 'fragile' });
    expect(fragile.harmony).toBe(40);
    expect(fragile.breath).toBe(2);
    expect(fragile.zones.find((z) => z.id === 'forest')!.form).toBe('burnt_land');
    for (const id of data.scenarios.keys()) expect(newGame(data, { seed: 1, scenario: id }).phase).toBe('play');
  });

  it('Szenario kann die Startstufe setzen (begrenzt auf 1–5)', () => {
    const d = dataWith((r) => {
      r.scenarios.scenarios[0].zones = { forest: { level: 9 } };
    });
    expect(newGame(d, { seed: 1 }).zones.find((z) => z.id === 'forest')!.level).toBe(5);
  });

  it('lehnt unbekannte Szenarien, Karten und falsche Deckgrößen ab', () => {
    expect(() => newGame(data, { seed: 1, scenario: 'nope' })).toThrow(RuleError);
    expect(() =>
      newGame(data, { seed: 1, deck: ['rain', 'nope', 'rain', 'rain', 'rain', 'rain', 'rain', 'rain'] }),
    ).toThrow(RuleError);
    expect(() => newGame(data, { seed: 1, deck: ['rain'] })).toThrow(/Deck/);
    expect(() => newGame(data, { seed: 1, deck: Array(8).fill('rain') })).toThrow(/rain 8× im Deck, erlaubt 2/);
    const deck = ['rain', 'rain', 'sun', 'sun', 'seeds', 'seeds', 'storm', 'storm'];
    const s = newGame(data, { seed: 1, deck });
    expect([...s.hand, ...s.drawPile].filter((c) => c.card === 'rain')).toHaveLength(2);
  });
});

describe('Rundenablauf (Konzept 3)', () => {
  it('Natur-Phase läuft in der Reihenfolge aus config.yaml, dann Bilanz und neue Runde', () => {
    const s = game({ hand: ['rain'], draw: ['sun', 'sun', 'sun', 'sun'] });
    const a = play(s, 'rain', {});
    const { state, events } = endTurn(a.state);
    const order = events
      .map((e) => e.type)
      .filter((t) => ['turnEnded', 'seasonApplied', 'harmonyChanged', 'breathChanged', 'roundStarted'].includes(t));
    expect(order).toEqual(['turnEnded', 'seasonApplied', 'harmonyChanged', 'breathChanged', 'roundStarted']);
    expect(state.round).toBe(2);
    expect(state.playsThisTurn).toBe(0);
    expect(state.hand).toHaveLength(4);
  });

  it('eine Runde ist eine Jahreszeit, vier Runden sind ein Jahr', () => {
    let s = game({ hand: [], draw: [], life: false });
    const seasons: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = endTurn(s);
      const e = r.events.find((x) => x.type === 'seasonApplied');
      seasons.push(e && e.type === 'seasonApplied' ? e.season : '?');
      s = r.state;
    }
    expect(seasons).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
    expect(s.round).toBe(6);
  });

  it('Pipeline ist über die Daten umsortier- und abschaltbar', () => {
    const d = dataWith((r) => {
      r.config.pipeline = ['breath'];
    });
    const s = game({ d, hand: [], draw: [] });
    const { events } = endTurn(s, d);
    expect(events.some((e) => e.type === 'seasonApplied' || e.type === 'harmonyChanged')).toBe(false);
    expect(events.some((e) => e.type === 'breathChanged')).toBe(true);
  });

  it('Kollaps beendet die Partie: phase over, keine neue Runde, keine weiteren Aktionen', () => {
    const s = game({ hand: [], draw: [] });
    s.harmony = 1;
    setStats(s, 'mountains', { vegetation: 0, snow: 0, moisture: 0 }); // Geröll, verödet: −3
    setStats(s, 'river', { water: 2 }); // Bach: der Frühling macht den Fluss nicht zur Aue (+2)
    const { state, events } = endTurn(s);
    expect(state.phase).toBe('over');
    expect(state.harmony).toBe(0);
    expect(state.round).toBe(1);
    expect(events).toContainEqual({ type: 'collapsed', round: 1 });
    expect(events.some((e) => e.type === 'breathChanged' || e.type === 'roundStarted')).toBe(false);
    expect(() => endTurn(state)).toThrow(/vorbei/);
    expect(canEndTurn(data, state)).toBe(false);
    expect(legalPlays(data, state)).toEqual([]);
  });
});

describe('Kartenzwang und Hand (Konzept 3, 6.2)', () => {
  it('ohne gespielte Karte kann die Runde nicht enden, solange eine bezahlbare Karte spielbar ist', () => {
    const s = game({ hand: ['rain', 'healing'], breath: 1 });
    expect(canEndTurn(data, s)).toBe(false);
    expect(() => endTurn(s)).toThrow(/Kartenzwang/);
    const a = play(s, 'rain', {});
    expect(canEndTurn(data, a.state)).toBe(true);
  });

  it('Naturgewalten kosten 0 Odem: man ist nie blockiert', () => {
    const s = game({ hand: ['thunderstorm', 'healing'], breath: 0 });
    expect(legalPlays(data, s).map((p) => p.card)).toEqual(Array(5).fill('thunderstorm'));
    expect(canEndTurn(data, s)).toBe(false);
  });

  it('ist keine Karte bezahlbar, darf die Runde ohne Karte enden', () => {
    const s = game({ hand: ['healing', 'balance'], breath: 2 });
    expect(legalPlays(data, s)).toEqual([]);
    expect(canEndTurn(data, s)).toBe(true);
    expect(endTurn(s).state.round).toBe(2);
  });

  it('mit leerer Hand darf die Runde enden', () => {
    expect(canEndTurn(data, game({ hand: [], draw: [] }))).toBe(true);
  });

  it('maxPlays begrenzt die Karten pro Runde', () => {
    const d = dataWith((r) => {
      r.config.turn.maxPlays = 1;
    });
    const s = game({ d, hand: ['rain', 'sun'], breath: 5 });
    const a = play(s, 'rain', {}, d);
    expect(legalPlays(d, a.state)).toEqual([]);
    expect(() => play(a.state, 'sun', { zone: 'forest' }, d)).toThrow(/keine Karte mehr/);
  });

  it('nach der Runde wird auf 4 nachgezogen; ungespielte Karten bleiben auf der Hand', () => {
    const s = game({ hand: ['rain', 'healing'], draw: ['sun', 'seeds', 'frost', 'storm'], breath: 3 });
    const a = play(s, 'rain', {});
    const { state } = endTurn(a.state);
    expect(state.hand.map((c) => c.card)).toEqual(['healing', 'sun', 'seeds', 'frost']);
    expect(state.drawPile.map((c) => c.card)).toEqual(['storm']);
    expect(state.discardPile.map((c) => c.card)).toEqual(['rain']);
  });

  it('ist der Stapel leer, wird die Ablage gemischt', () => {
    const s = game({ hand: ['rain', 'sun', 'seeds', 'frost'], draw: [], breath: 5 });
    let cur = s;
    for (const [card, targets] of [
      ['rain', {}],
      ['sun', { zone: 'forest' }],
      ['seeds', { zone: 'forest' }],
    ] as const)
      cur = play(cur, card, targets).state;
    expect(cur.discardPile).toHaveLength(3);
    const { state, events } = endTurn(cur);
    expect(events).toContainEqual({ type: 'deckReshuffled', cards: 3 });
    expect(state.hand).toHaveLength(4);
    expect(state.hand.map((c) => c.card).sort()).toEqual(['frost', 'rain', 'seeds', 'sun']);
    expect(state.discardPile).toEqual([]);
    expect(state.drawPile).toEqual([]);
  });
});

describe('Reinheit und Determinismus', () => {
  /** Spielt eine Partie mit festen Regeln (erste legale Karte, dann Runde beenden) und sammelt die Ereignisse. */
  function playout(seed: string, rounds: number): GameEvent[] {
    let s = newGame(data, { seed });
    const all: GameEvent[] = [];
    for (let i = 0; i < rounds && s.phase === 'play'; i++) {
      const p = legalPlays(data, s)[0];
      if (p) {
        const r = step(data, s, { type: 'play', uid: p.uid, targets: p.targets });
        all.push(...r.events);
        s = r.state;
      }
      const r = step(data, s, { type: 'endTurn' });
      all.push(...r.events);
      s = r.state;
    }
    return all;
  }

  it('gleicher Seed ⇒ gleiche Ereignisse; anderer Seed ⇒ andere Kartenfolge', () => {
    const a = playout('seed-a', 30);
    expect(playout('seed-a', 30)).toEqual(a);
    expect(newGame(data, { seed: 'x' })).toEqual(newGame(data, { seed: 'x' }));
    expect(newGame(data, { seed: 'x' }).hand).not.toEqual(newGame(data, { seed: 'y' }).hand);
  });

  it('step verändert den Eingangszustand nicht', () => {
    const s = game({ hand: ['thunderstorm', 'rain', 'storm'], draw: [], breath: 3 });
    setStats(s, 'forest', { moisture: 1 });
    const before = structuredClone(s);
    const a = play(s, 'thunderstorm', { zone: 'forest' });
    expect(s).toEqual(before);
    const frozen = structuredClone(a.state);
    endTurn(a.state);
    expect(a.state).toEqual(frozen);
  });

  it('ungültige Aktionen werfen RuleError', () => {
    const s = game({ hand: ['storm', 'healing'], breath: 1 });
    expect(() => step(data, s, { type: 'play', uid: 999, targets: {} })).toThrow(/nicht auf der Hand/);
    expect(() => play(s, 'storm', {})).toThrow(/Ziel fehlt/);
    expect(() => play(s, 'storm', { zone: 'nowhere', fall: 'river' })).toThrow(/Ungültiges Ziel/);
    expect(() => play(s, 'healing', { zone: 'forest' })).toThrow(/Zu wenig Odem/);
  });
});
