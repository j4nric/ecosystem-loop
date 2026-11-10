/** Konzept 6: Wölfe reißen, wandern durchs Gehölz, wachsen, gründen, verhungern, wandern ein. */
import { describe, expect, it } from 'vitest';
import { step } from '../src/index.ts';
import { act, addPack, advance, blank, NEIGHBORS, ofType, put, season, tweak } from './helpers.ts';

describe('Wölfe', () => {
  it('reißen Tiere, wenn die Herde in Reichweite ist (je Rudel so viele wie seine Stärke)', () => {
    const s = season(blank(), 2);
    s.herd.fat = 20;
    put(s, 2, 3, 'bush', { food: 0 });
    for (const y of [2, 3, 4]) put(s, 4, y, 'rock'); // kein Ausweg
    const pack = addPack(s, 2, 3, 2, { hungry: 5 });
    const r = advance(s);
    expect(ofType(r.events, 'wolvesHunted')).toEqual([{ type: 'wolvesHunted', pack: pack.id, killed: 2 }]);
    expect(r.state.herd.size).toBe(8);
    expect(r.state.packs[0]).toMatchObject({ fed: 2, hungry: 0 });
  });

  it('außer Reichweite hungern sie', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    addPack(s, 0, 0);
    expect(advance(s).state.packs[0]).toMatchObject({ hungry: 1, fed: 0 });
  });

  it('hungrige Rudel ziehen durch zusammenhängendes Gehölz auf die Herde zu, nicht über offenes Land', () => {
    let s = season(blank(), 2);
    s.herd.fat = 20;
    for (const [dx, dy] of NEIGHBORS) put(s, 3 + dx, 3 + dy, 'rock'); // Herde bleibt stehen
    put(s, 0, 3, 'forest', { food: 0 });
    put(s, 1, 3, 'forest', { food: 0 });
    const pack = addPack(s, 0, 3, 1, { hungry: 1 });
    let r = advance(s);
    expect(ofType(r.events, 'packMoved')).toEqual([
      { type: 'packMoved', pack: pack.id, from: { x: 0, y: 3 }, to: { x: 1, y: 3 } },
    ]);
    s = r.state;
    s.herd.fat = 20;
    r = advance(s);
    expect(r.state.herd).toMatchObject({ x: 3, y: 3 });
    expect(r.state.packs[0]).toMatchObject({ x: 1, y: 3, hungry: 3 }); // (2,3) ist kein Gehölz
    expect(ofType(r.events, 'packMoved')).toEqual([]);
  });

  it('satte Rudel bleiben, wo sie sind', () => {
    const s = season(blank(), 2);
    put(s, 0, 3, 'bush');
    put(s, 1, 3, 'bush');
    addPack(s, 0, 3, 1, { hungry: 0 });
    expect(advance(s).state.packs[0]).toMatchObject({ x: 0, y: 3 });
  });

  it('satte Rudel wachsen bis zur vollen Stärke', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    const pack = addPack(s, 0, 0, 1, { fed: 4 });
    const r = advance(s);
    expect(r.state.packs[0]).toMatchObject({ size: 2, fed: 0 });
    expect(ofType(r.events, 'packGrew')).toEqual([{ type: 'packGrew', pack: pack.id, size: 2 }]);
  });

  it('in voller Stärke gründen sie ein neues Rudel im Gehölz in der Nähe', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    put(s, 1, 0, 'bush');
    put(s, 2, 0, 'forest');
    put(s, 6, 6, 'forest'); // zu weit weg
    const pack = addPack(s, 0, 0, 3, { fed: 4 });
    const r = advance(s);
    const founded = ofType(r.events, 'packFounded');
    expect(founded).toHaveLength(1);
    expect(founded[0]).toMatchObject({ parent: pack.id });
    expect([1, 2]).toContain(founded[0]!.x);
    expect(founded[0]!.y).toBe(0);
    expect(r.state.packs).toHaveLength(2);
    expect(r.state.packs[1]).toMatchObject({ id: founded[0]!.pack, size: 1, fed: 0, hungry: 0 });
    expect(r.state.nextPackId).toBe(s.nextPackId + 1);
  });

  it('ohne freies Gehölz gründet sich kein Rudel', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    addPack(s, 0, 0, 3, { fed: 4 });
    const r = advance(s);
    expect(ofType(r.events, 'packFounded')).toEqual([]);
    expect(r.state.packs).toHaveLength(1);
  });

  it('zwei Gründungen im selben Monat landen nicht auf demselben Feld', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    put(s, 0, 1, 'forest');
    put(s, 1, 0, 'forest');
    addPack(s, 0, 0, 3, { fed: 4 });
    addPack(s, 0, 1, 3, { fed: 4 });
    const r = advance(s);
    expect(ofType(r.events, 'packFounded')).toHaveLength(1);
    expect(r.state.packs.map((p) => `${p.x},${p.y}`).sort()).toEqual(['0,0', '0,1', '1,0']);
  });

  it('hungrige Rudel verkümmern und verhungern', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    put(s, 6, 0, 'forest');
    const weak = addPack(s, 0, 0, 1, { hungry: 7 });
    const strong = addPack(s, 6, 0, 2, { hungry: 7 });
    const r = advance(s);
    expect(ofType(r.events, 'packStarved')).toEqual([
      { type: 'packStarved', pack: weak.id, size: 0 },
      { type: 'packStarved', pack: strong.id, size: 1 },
    ]);
    expect(ofType(r.events, 'packGone')).toEqual([{ type: 'packGone', pack: weak.id, x: 0, y: 0, cause: 'starved' }]);
    expect(r.state.packs).toEqual([{ id: strong.id, x: 6, y: 0, size: 1, fed: 0, hungry: 4 }]);
  });

  describe('Einwandern', () => {
    const sure = tweak((d) => (d.params.wolves.spawnChance = 1));
    const forests = (n: number, land = 'forest') => {
      const s = season(blank(), 2);
      for (let x = 0; x < n; x++) put(s, x, 0, land);
      return s;
    };

    it('ohne Rudel wandern bei genug Wald neue ein', () => {
      const r = step(sure, forests(5), { type: 'advance' });
      const ev = ofType(r.events, 'packImmigrated');
      expect(ev).toHaveLength(1);
      expect(ev[0]!.y).toBe(0);
      expect(r.state.packs).toEqual([{ id: ev[0]!.pack, x: ev[0]!.x, y: 0, size: 1, fed: 0, hungry: 0 }]);
    });

    it('zu wenig Gehölz: niemand wandert ein', () => {
      expect(step(sure, forests(4), { type: 'advance' }).state.packs).toEqual([]);
    });

    it('nur Busch ist kein Revier', () => {
      expect(step(sure, forests(6, 'bush'), { type: 'advance' }).state.packs).toEqual([]);
    });

    it('solange ein Rudel lebt, wandert keines ein', () => {
      const s = forests(5);
      addPack(s, 0, 0);
      expect(step(sure, s, { type: 'advance' }).state.packs).toHaveLength(1);
    });
  });

  it('Fels vertreibt ein Rudel', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'bush');
    const pack = addPack(s, 0, 0);
    s.hand = ['rock'];
    const r = act(s, { type: 'play', hand: 0, x: 0, y: 0 });
    expect(r.state.packs).toEqual([]);
    expect(ofType(r.events, 'packGone')).toEqual([{ type: 'packGone', pack: pack.id, x: 0, y: 0, cause: 'driven' }]);
  });

  it('ein Rudel außerhalb des Gehölzes verschwindet am Monatsende', () => {
    const s = season(blank(), 2);
    const pack = addPack(s, 0, 0); // Steppe (z. B. aus einem alten Spielstand)
    const r = advance(s);
    expect(r.state.packs).toEqual([]);
    expect(ofType(r.events, 'packGone')).toEqual([{ type: 'packGone', pack: pack.id, x: 0, y: 0, cause: 'driven' }]);
  });
});
