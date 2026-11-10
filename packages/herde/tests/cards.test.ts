/** Konzept 7: jede Karte, gültige und ungültige Ziele, Wildnis, Ziehen mit Handlimit. */
import { describe, expect, it } from 'vitest';
import { legalPlays, RuleError, view, type HerdeState } from '../src/index.ts';
import { act, addPack, advance, at, blank, data, ofType, put, season } from './helpers.ts';

function withCard(card: string): HerdeState {
  const s = season(blank(), 2);
  s.hand = [card];
  return s;
}

const targets = (s: HerdeState) => view(data, s).hand[0]!.targets.map((p) => `${p.x},${p.y}`);

describe('Karten', () => {
  it('Wiese säen: Steppe oder Brand → Wiese mit Futter 2, frisch beweidet', () => {
    const s = withCard('seed');
    put(s, 0, 0, 'burnt');
    put(s, 1, 0, 'meadow');
    const t = targets(s);
    expect(t).toContain('0,0');
    expect(t).toContain('6,6');
    expect(t).not.toContain('1,0');
    const r = act(s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(at(r.state, 0, 0)).toMatchObject({ land: 'meadow', food: 2, age: 0, grazed: s.month });
    expect(r.events).toEqual([
      { type: 'cardPlayed', card: 'seed', hand: 0, x: 0, y: 0, wild: 2 },
      { type: 'cellChanged', x: 0, y: 0, from: 'burnt', to: 'meadow', cause: 'card' },
    ]);
    expect(r.state.wild).toBe(s.wild + 2);
    expect(r.state.hand).toEqual([]);
  });

  it('Bäume pflanzen: Steppe oder Wiese → Busch ohne Futter', () => {
    const s = withCard('trees');
    put(s, 0, 0, 'meadow', { food: 5 });
    put(s, 1, 0, 'forest');
    expect(targets(s)).not.toContain('1,0');
    const r = act(s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(at(r.state, 0, 0)).toMatchObject({ land: 'bush', food: 0, age: 0 });
  });

  it('Quelle: Steppe oder Wiese → Wasser, auch unter der Herde', () => {
    const s = withCard('spring');
    put(s, 3, 3, 'meadow', { food: 4 });
    const r = act(s, { type: 'play', hand: 0, x: 3, y: 3 });
    expect(at(r.state, 3, 3)).toMatchObject({ land: 'river', food: 0 });
  });

  it('Fels: sperrt Steppe, Wiese oder Busch – nie das Feld der Herde', () => {
    const s = withCard('rock');
    put(s, 0, 0, 'bush');
    put(s, 1, 0, 'forest');
    const t = targets(s);
    expect(t).toContain('0,0');
    expect(t).not.toContain('1,0');
    expect(t).not.toContain('3,3');
    expect(() => act(s, { type: 'play', hand: 0, x: 3, y: 3 })).toThrow(RuleError);
    const r = act(s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(at(r.state, 0, 0)).toMatchObject({ land: 'rock', food: 0 });
    expect(r.state.wild).toBe(s.wild + 1);
  });

  it('Blitz: nur auf Gehölz', () => {
    const s = withCard('lightning');
    put(s, 0, 0, 'old');
    put(s, 1, 1, 'forest');
    put(s, 2, 2, 'bush');
    expect(targets(s)).toEqual(['0,0', '1,1', '2,2']);
    expect(() => act(s, { type: 'play', hand: 0, x: 4, y: 4 })).toThrow(/darf nicht/);
  });

  it('Regen: ganze Insel Gras +2 (nur Wiese, Steppe, Busch, Wald), höchstens bis zum Maximum', () => {
    const s = withCard('rain');
    put(s, 0, 0, 'meadow', { food: 5 });
    put(s, 1, 0, 'bush', { food: 0 });
    put(s, 2, 0, 'forest', { food: 0 });
    put(s, 3, 0, 'old', { food: 0 });
    put(s, 4, 0, 'meadow', { food: 1, fertile: 3 });
    expect(view(data, s).hand[0]).toMatchObject({ global: true, targets: [] });
    expect(legalPlays(data, s)).toEqual([{ type: 'play', hand: 0 }]);
    const r = act(s, { type: 'play', hand: 0 });
    expect([0, 1, 2, 3, 4].map((x) => at(r.state, x, 0).food)).toEqual([6, 2, 1, 0, 3]);
    expect(at(r.state, 6, 6).food).toBe(1); // Steppe
    expect(ofType(r.events, 'grassGrew')).toEqual([{ type: 'grassGrew', card: 'rain', amount: 2, cells: 48 }]);
  });

  it('ungültige Züge werfen RuleError und ändern nichts', () => {
    const s = withCard('seed');
    const before = structuredClone(s);
    expect(() => act(s, { type: 'play', hand: 1, x: 0, y: 0 })).toThrow(/Keine Karte/);
    expect(() => act(s, { type: 'play', hand: 0 })).toThrow(/Zielfeld/);
    expect(() => act(s, { type: 'play', hand: 0, x: 7, y: 0 })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', hand: 0, x: -1, y: 0 })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', hand: 0, x: 0.5, y: 0 })).toThrow(RuleError);
    expect(s).toEqual(before);
  });

  it('legalPlays: jede Handkarte mit jedem gültigen Ziel', () => {
    const s = season(blank(), 2);
    s.hand = ['rock', 'rain', 'lightning'];
    put(s, 0, 0, 'forest');
    addPack(s, 0, 0);
    const plays = legalPlays(data, s);
    expect(plays.filter((p) => p.type === 'play' && p.hand === 0)).toHaveLength(47);
    expect(plays.filter((p) => p.type === 'play' && p.hand === 1)).toEqual([{ type: 'play', hand: 1 }]);
    expect(plays.filter((p) => p.type === 'play' && p.hand === 2)).toEqual([{ type: 'play', hand: 2, x: 0, y: 0 }]);
    for (const p of plays) expect(() => act(s, p)).not.toThrow();
  });
});

describe('Kartenziehen', () => {
  const toSeasonStart = (hand: string[]) => {
    const s = season(blank(), 2, 2);
    s.herd.fat = 20;
    s.hand = hand;
    return advance(s);
  };

  it('zu Beginn jeder Jahreszeit 2 Karten', () => {
    const r = toSeasonStart(['rain']);
    expect(r.state.hand).toHaveLength(3);
    expect(ofType(r.events, 'cardsDrawn')[0]!.cards).toEqual(r.state.hand.slice(1));
    expect(ofType(r.events, 'seasonBegan')).toEqual([{ type: 'seasonBegan', season: 'winter', month: 21, year: 2 }]);
  });

  it('höchstens 5 Karten auf der Hand, kein Ablegen', () => {
    expect(toSeasonStart(['rain', 'rain', 'rain', 'rain']).state.hand).toHaveLength(5);
    const full = toSeasonStart(['rain', 'rain', 'rain', 'rain', 'rain']);
    expect(full.state.hand).toEqual(['rain', 'rain', 'rain', 'rain', 'rain']);
    expect(ofType(full.events, 'cardsDrawn')).toEqual([]);
  });

  it('mitten in der Jahreszeit wird nicht gezogen', () => {
    const s = season(blank(), 2, 0);
    s.hand = [];
    expect(advance(s).state.hand).toEqual([]);
  });

  it('Ziehgewichte: alle Karten kommen vor, häufigere öfter', () => {
    const counts: Record<string, number> = {};
    let s = season(blank(), 2, 2);
    for (let i = 0; i < 400; i++) {
      s.hand = [];
      s.month = 20;
      s.wild = 8;
      s.herd.fat = 20;
      s.herd.size = 10;
      s = advance(s).state;
      for (const c of s.hand) counts[c] = (counts[c] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual([...data.cards.keys()].sort());
    expect(counts.seed!).toBeGreaterThan(counts.rock!);
  });
});
