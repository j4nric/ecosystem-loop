/** Konzept 4: Wachstum je Jahreszeit, Sukzession, Feuer. */
import { describe, expect, it } from 'vitest';
import { step, view } from '../src/index.ts';
import { act, addPack, advance, at, blank, data, keepAlive, NEIGHBORS, ofType, put, season, tweak } from './helpers.ts';

describe('Wachstum je Jahreszeit', () => {
  it.each([
    [0, 3, 1],
    [1, 2, 0],
    [2, 1, 0],
    [3, 0, 0],
  ])('Jahreszeit %i: Wiese +%i, Steppe +%i', (si, meadow, steppe) => {
    const s = season(blank(), si, 0);
    put(s, 0, 0, 'meadow', { food: 0, grazed: s.month });
    const { state } = advance(s);
    expect(at(state, 0, 0).food).toBe(meadow);
    expect(at(state, 6, 6).food).toBe(steppe);
  });

  it('Futter wächst höchstens bis zum Maximum, fruchtbare Wiese höher', () => {
    const s = season(blank(), 0, 0);
    put(s, 0, 0, 'meadow', { food: 5, grazed: s.month });
    put(s, 6, 0, 'meadow', { food: 5, grazed: s.month, fertile: 10 });
    const { state } = advance(s);
    expect(at(state, 0, 0).food).toBe(6);
    expect(at(state, 6, 0).food).toBe(8);
  });
});

describe('Sukzession', () => {
  it('Wiese verbuscht nur unbeweidet', () => {
    const s = season(blank(), 2, 0);
    put(s, 3, 3, 'meadow', { food: 6, grazed: s.month - 11 }); // unter der Herde
    put(s, 0, 0, 'meadow', { food: 4, grazed: s.month - 11 }); // weit weg
    let r = advance(s);
    expect(at(r.state, 3, 3).grazed).toBe(s.month);
    expect(at(r.state, 0, 0).land).toBe('meadow');
    r = advance(r.state);
    expect(at(r.state, 0, 0)).toMatchObject({ land: 'bush', food: 2, age: 0 });
    expect(at(r.state, 3, 3).land).toBe('meadow');
    expect(ofType(r.events, 'cellChanged')).toEqual([
      { type: 'cellChanged', x: 0, y: 0, from: 'meadow', to: 'bush', cause: 'succession' },
    ]);
  });

  it('Busch → Wald → Altwald nach ihrem Alter, Futter wird gekappt', () => {
    const s = season(blank(), 2, 0);
    put(s, 0, 0, 'bush', { food: 2, age: 17 });
    put(s, 6, 0, 'forest', { food: 1, age: 35 });
    const { state } = advance(s);
    expect(at(state, 0, 0)).toMatchObject({ land: 'forest', food: 1, age: 0 });
    expect(at(state, 6, 0)).toMatchObject({ land: 'old', food: 0, age: 0 });
  });

  it('Brandfläche → fruchtbare Wiese (+2 Futter-Maximum), die Fruchtbarkeit läuft ab', () => {
    const s = season(blank(), 2, 0);
    put(s, 0, 0, 'burnt', { age: 3 });
    let { state } = advance(s);
    expect(at(state, 0, 0)).toMatchObject({ land: 'meadow', food: 3, fertile: 24, grazed: s.month });
    const v = view(data, state).cells[0]!;
    expect(v).toMatchObject({ fertile: true, maxFood: 8 });
    for (let i = 0; i < 24; i++) {
      at(state, 0, 0).grazed = state.month; // offen halten
      keepAlive(state);
      state = advance(state).state;
    }
    expect(at(state, 0, 0).fertile).toBe(0);
    expect(view(data, state).cells[0]).toMatchObject({ fertile: false, maxFood: 6 });
  });

  it('die Prognose nennt die genaue Zahl der Monate', () => {
    let s = season(blank(), 2, 0);
    put(s, 0, 0, 'meadow', { food: 1, grazed: s.month - 5 });
    put(s, 6, 0, 'bush', { age: 10 });
    put(s, 0, 6, 'burnt', { age: 1 });
    put(s, 6, 6, 'river');
    for (const [dx, dy] of NEIGHBORS) put(s, 3 + dx, 3 + dy, 'rock'); // Herde bleibt stehen
    const v = view(data, s);
    const meadow = v.cells[0]!.forecast!;
    expect(meadow).toEqual({ to: 'bush', inMonths: 8, clock: 'ungrazed', fertile: false });
    expect(v.cells[6]!.forecast).toEqual({ to: 'forest', inMonths: 8, clock: 'age', fertile: false });
    expect(v.cells[42]!.forecast).toEqual({ to: 'meadow', inMonths: 3, clock: 'age', fertile: true });
    expect(v.cells[48]!.forecast).toBeNull();
    for (let i = 0; i < 7; i++) s = advance(keepAlive(s)).state;
    expect(at(s, 0, 0).land).toBe('meadow');
    expect(at(s, 6, 0).land).toBe('bush');
    s = advance(keepAlive(s)).state;
    expect(at(s, 0, 0).land).toBe('bush');
    expect(at(s, 6, 0).land).toBe('forest');
  });
});

describe('Feuer', () => {
  const fiery = tweak((d) => {
    d.landscapes.get('old')!.fireChance = 1;
    d.params.fire.spread = 0;
  });

  it('Altwald brennt im Sommer von selbst, nicht in anderen Jahreszeiten', () => {
    const summer = season(blank(), 1, 0);
    put(summer, 0, 0, 'old');
    const r = step(fiery, summer, { type: 'advance' });
    expect(at(r.state, 0, 0).land).toBe('burnt');
    expect(ofType(r.events, 'fire')).toEqual([
      { type: 'fire', cause: 'wildfire', x: 0, y: 0, cells: [{ x: 0, y: 0 }] },
    ]);
    for (const si of [0, 2, 3]) {
      const s = season(blank(), si, 0);
      put(s, 0, 0, 'old');
      expect(at(step(fiery, s, { type: 'advance' }).state, 0, 0).land).toBe('old');
    }
  });

  it('Feuer springt auf benachbartes Gehölz über (4er-Nachbarschaft), nicht diagonal', () => {
    const spreading = tweak((d) => (d.params.fire.spread = 1));
    const s = season(blank(), 2, 0);
    put(s, 0, 0, 'bush');
    put(s, 1, 0, 'forest');
    put(s, 2, 0, 'old');
    put(s, 3, 1, 'bush'); // nur diagonal zu (2,0)
    s.hand = ['lightning'];
    const r = step(spreading, s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(['burnt', 'burnt', 'burnt'].join()).toBe([0, 1, 2].map((x) => at(r.state, x, 0).land).join());
    expect(at(r.state, 3, 1).land).toBe('bush');
    expect(ofType(r.events, 'fire')[0]).toMatchObject({
      cause: 'lightning',
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    });
    expect(ofType(r.events, 'cellChanged').every((e) => e.cause === 'fire')).toBe(true);
  });

  it('ohne Übersprung brennt nur das getroffene Feld', () => {
    const s = season(blank(), 2, 0);
    put(s, 0, 0, 'bush');
    put(s, 1, 0, 'bush');
    s.hand = ['lightning'];
    const r = step(fiery, s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(at(r.state, 0, 0).land).toBe('burnt');
    expect(at(r.state, 1, 0).land).toBe('bush');
  });

  it('ein Rudel im Feuer stirbt', () => {
    const s = season(blank(), 2, 0);
    put(s, 0, 0, 'forest');
    const pack = addPack(s, 0, 0, 2);
    s.hand = ['lightning'];
    const r = act(s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(r.state.packs).toEqual([]);
    expect(ofType(r.events, 'packGone')).toEqual([{ type: 'packGone', pack: pack.id, x: 0, y: 0, cause: 'fire' }]);
  });

  it('brennt das Feld der Herde im Waldbrand, verliert sie Tiere', () => {
    const s = season(blank(), 1, 0);
    put(s, 3, 3, 'old');
    const r = step(fiery, s, { type: 'advance' });
    expect(ofType(r.events, 'herdBurned')).toEqual([{ type: 'herdBurned', dead: 2 }]);
    expect(r.state.herd.size).toBe(8);
  });

  it('Blitz auf das Feld der Herde kostet keine Tiere (wie im Prototyp)', () => {
    const s = season(blank(), 2, 0);
    put(s, 3, 3, 'bush');
    s.hand = ['lightning'];
    const r = act(s, { type: 'play', hand: 0, x: 3, y: 3 });
    expect(at(r.state, 3, 3).land).toBe('burnt');
    const next = advance(r.state);
    expect(ofType(next.events, 'herdBurned')).toEqual([]);
  });
});
