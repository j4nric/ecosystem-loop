/** Konzept 5: Herdenwahl, Fressen und Vorrat, Durst, Kälte, Nachwuchs. */
import { describe, expect, it } from 'vitest';
import { legalPlays, newGame, step, view } from '../src/index.ts';
import { nextFloat, pick } from '../src/rng.ts';
import { addPack, advance, at, blank, data, keepAlive, NEIGHBORS, ofType, put, season } from './helpers.ts';

const intent = (s: Parameters<typeof view>[1]) => view(data, s).intent!;

describe('Herdenwahl', () => {
  it('zieht zu Futter in Reichweite (Gleichstand: erstes Feld von oben links)', () => {
    const s = season(blank(), 2);
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    expect(intent(s)).toEqual({ x: 4, y: 2, dx: 1, dy: -1, stays: false, reason: 'freshGrass' });
    const r = advance(s);
    expect(r.state.herd).toMatchObject({ x: 4, y: 2 });
    expect(ofType(r.events, 'herdMoved')).toEqual([
      { type: 'herdMoved', from: { x: 3, y: 3 }, to: { x: 4, y: 2 }, reason: 'freshGrass' },
    ]);
  });

  it('ohne Anreiz bleibt sie stehen', () => {
    const s = season(blank(), 2);
    expect(intent(s)).toMatchObject({ x: 3, y: 3, stays: true, reason: 'stay' });
  });

  it('sucht im Sommer Wasser, sonst nicht', () => {
    const summer = season(blank(), 1);
    put(summer, 5, 3, 'river');
    expect(intent(summer)).toMatchObject({ x: 4, y: 2, reason: 'seekWater' });
    const autumn = season(blank(), 2);
    put(autumn, 5, 3, 'river');
    expect(intent(autumn)).toMatchObject({ stays: true, reason: 'stay' });
  });

  it('sucht im Winter Schutz, sonst nicht', () => {
    const winter = season(blank(), 3);
    put(winter, 5, 3, 'bush', { food: 0 });
    expect(intent(winter)).toMatchObject({ x: 4, y: 2, reason: 'seekShelter' });
    const autumn = season(blank(), 2);
    put(autumn, 5, 3, 'old');
    expect(intent(autumn)).toMatchObject({ stays: true });
  });

  it('weicht Wölfen aus', () => {
    const s = season(blank(), 2);
    put(s, 2, 3, 'bush', { food: 0 });
    addPack(s, 2, 3);
    expect(intent(s)).toMatchObject({ x: 4, y: 2, reason: 'avoidWolves' });
  });

  it('meidet kürzlich besuchte Felder', () => {
    const s = season(blank(), 2);
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    s.herd.trail = [{ x: 4, y: 2 }];
    expect(intent(s)).toMatchObject({ x: 4, y: 3, reason: 'freshGrass' });
  });

  it('die Spur ist begrenzt (stages.yaml → trail)', () => {
    let s = season(blank(), 2);
    for (let i = 0; i < 6; i++) s = advance(keepAlive(s)).state;
    expect(s.herd.trail.length).toBe(data.stages.get('herd')!.trail);
  });

  it.each(['rock', 'sea'])('betritt kein Feld %s, auch wenn dahinter Futter liegt', (blocker) => {
    const s = season(blank(), 2);
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    expect(intent(s)).toMatchObject({ x: 4, y: 2 });
    for (const y of [2, 3, 4]) put(s, 4, y, blocker);
    expect(intent(s)).toMatchObject({ x: 3, y: 3, stays: true });
    expect(advance(s).state.herd).toMatchObject({ x: 3, y: 3 });
  });

  it('ist deterministisch und view zeigt genau den Zug von advance (Zufalls-Partien)', () => {
    const bot = { rng: 99 };
    for (const seed of [1, 2, 3, 4, 5]) {
      let s = newGame(data, { seed });
      while (!s.over) {
        const plays = legalPlays(data, s);
        if (plays.length > 0 && nextFloat(bot) < 0.6) s = step(data, s, pick(bot, plays)).state;
        const v1 = view(data, s).intent;
        const v2 = view(data, s).intent;
        expect(v1).toEqual(v2);
        const next = advance(s);
        expect(next.state.herd).toMatchObject({ x: v1!.x, y: v1!.y });
        expect(ofType(next.events, 'herdMoved')[0]!.reason).toBe(v1!.reason);
        expect(data.landscapes.get(at(next.state, next.state.herd.x, next.state.herd.y).land)!.walk).toBe(true);
        s = next.state;
      }
    }
  });
});

describe('Fressen und Vorrat', () => {
  const meadows = (s: ReturnType<typeof blank>, food: number) => {
    put(s, 3, 3, 'meadow', { food, grazed: s.month });
    for (const [dx, dy] of NEIGHBORS) put(s, 3 + dx, 3 + dy, 'meadow', { food, grazed: s.month });
  };

  it('frisst höchstens Bedarf × eatFactor; Überschuss wird Vorrat', () => {
    const s = season(blank(), 2);
    meadows(s, 6);
    const r = advance(s);
    expect(ofType(r.events, 'herdAte')).toEqual([{ type: 'herdAte', eaten: 15, need: 10, fat: 15 }]);
    const left = [at(r.state, 3, 3), ...NEIGHBORS.map(([dx, dy]) => at(r.state, 3 + dx, 3 + dy))];
    expect(left.reduce((a, c) => a + c.food, 0)).toBe(54 - 15);
  });

  it('frisst die vollsten Felder zuerst und merkt sich die Beweidung', () => {
    const s = season(blank(), 2);
    s.herd.size = 2;
    put(s, 2, 2, 'meadow', { food: 2, grazed: s.month - 3 });
    put(s, 4, 4, 'meadow', { food: 5, grazed: s.month - 3 });
    const r = advance(s);
    expect(r.state.herd).toMatchObject({ x: 3, y: 3 });
    expect(at(r.state, 4, 4)).toMatchObject({ food: 3, grazed: s.month });
    expect(at(r.state, 2, 2)).toMatchObject({ food: 3, grazed: s.month - 3 });
  });

  it('der Vorrat ist gedeckelt (fatCap × Größe)', () => {
    const s = season(blank(), 2);
    meadows(s, 6);
    s.herd.fat = 18;
    expect(advance(s).state.herd.fat).toBe(20);
  });

  it('Mangel zehrt den Vorrat auf', () => {
    const s = season(blank(), 2);
    put(s, 3, 3, 'meadow', { food: 3, grazed: s.month }); // + 1 Wachstum im Herbst
    const r = advance(s);
    expect(r.state.herd).toMatchObject({ size: 10, fat: 4 });
    expect(ofType(r.events, 'herdStarved')).toEqual([]);
  });

  it('ist der Vorrat leer, sterben Tiere (Mangel × starveRate)', () => {
    const s = season(blank(), 2);
    s.herd.fat = 4;
    const r = advance(s);
    expect(ofType(r.events, 'herdStarved')).toEqual([{ type: 'herdStarved', dead: 3 }]);
    expect(r.state.herd).toMatchObject({ size: 7, fat: 0 });
  });
});

describe('Jahreszeiten: Durst, Kälte, Nachwuchs', () => {
  it('Durst: ab dem zweiten Sommermonat ohne Wasser sterben Tiere', () => {
    let s = season(blank(), 1, 0);
    s.herd.fat = 20;
    let r = advance(s);
    expect(r.state.herd.thirst).toBe(1);
    expect(ofType(r.events, 'herdThirsted')).toEqual([]);
    r = advance(r.state);
    expect(ofType(r.events, 'herdThirsted')).toEqual([{ type: 'herdThirsted', dead: 1 }]);
    expect(r.state.herd.size).toBe(9);
    s = r.state;
    put(s, 3, 2, 'river');
    r = advance(s);
    expect(r.state.herd.thirst).toBe(0);
  });

  it('Kälte: im Winter ohne Gehölz in der Nähe sterben Tiere', () => {
    const cold = season(blank(), 3);
    cold.herd.fat = 20;
    const r = advance(cold);
    expect(ofType(r.events, 'herdFroze')).toEqual([{ type: 'herdFroze', dead: 1 }]);
    const sheltered = season(blank(), 3);
    sheltered.herd.fat = 20;
    put(sheltered, 3, 3, 'bush', { food: 0 });
    expect(ofType(advance(sheltered).events, 'herdFroze')).toEqual([]);
  });

  it('Nachwuchs im zweiten Frühlingsmonat, je nach Vorrat', () => {
    const fat = season(blank(), 0, 1);
    put(fat, 3, 3, 'meadow', { food: 6, grazed: fat.month });
    for (const [dx, dy] of NEIGHBORS) put(fat, 3 + dx, 3 + dy, 'meadow', { food: 6, grazed: fat.month });
    let r = advance(fat);
    expect(ofType(r.events, 'herdBorn')).toEqual([{ type: 'herdBorn', born: 3 }]);
    expect(r.state.herd).toMatchObject({ size: 13, fat: 12 });

    const lean = season(blank(), 0, 1);
    lean.herd.fat = 0;
    put(lean, 3, 3, 'meadow', { food: 6, grazed: lean.month });
    r = advance(lean); // isst 6 + 8 × 1 (Steppe) = 14 → Vorrat 4
    expect(ofType(r.events, 'herdBorn')).toEqual([{ type: 'herdBorn', born: 1 }]);

    const other = season(blank(), 0, 2);
    other.herd.fat = 20;
    expect(ofType(advance(other).events, 'herdBorn')).toEqual([]);
  });

  it('kein Nachwuchs in der Eiszeit', () => {
    const s = season(blank(), 0, 1);
    s.ice = 3;
    s.herd.fat = 20;
    put(s, 3, 3, 'bush');
    expect(ofType(advance(s).events, 'herdBorn')).toEqual([]);
  });
});
