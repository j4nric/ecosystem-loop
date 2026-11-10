/** Fassade, Konzept 8 (Wildnis, Eiszeit, Sieg, Niederlage), view, validateState, Bot. */
import { describe, expect, it } from 'vitest';
import {
  legalPlays,
  newGame,
  playRandomGame,
  RuleError,
  STATE_VERSION,
  step,
  validateState,
  view,
  type HerdeState,
} from '../src/index.ts';
import { addPack, advance, blank, data, NEIGHBORS, ofType, put, season } from './helpers.ts';

describe('newGame', () => {
  it('Startinsel aus den Daten: Raster, Herde, Rudel, Wildnis, Starthand', () => {
    const s = newGame(data, { seed: 5 });
    const island = data.islands.get('start')!;
    expect(s).toMatchObject({ version: STATE_VERSION, island: 'start', month: 0, ice: 0, wild: 8, over: null });
    expect(s.cells.map((c) => c.land)).toEqual(island.cells);
    expect(s.herd).toEqual({
      stage: 'herd',
      x: 1,
      y: 5,
      size: 10,
      fat: 10,
      thirst: 0,
      trail: [],
      traits: [],
      experience: Object.fromEntries([...data.experiences.keys()].map((id) => [id, 0])),
      offer: [],
    });
    expect(s.packs).toEqual([{ id: 1, x: 5, y: 2, size: 1, fed: 0, hungry: 0 }]);
    expect(s.nextPackId).toBe(2);
    expect(s.hand).toHaveLength(3);
    for (const c of s.cells) {
      if (c.land === 'meadow') {
        expect(c.food).toBeGreaterThanOrEqual(3);
        expect(c.food).toBeLessThanOrEqual(5);
        expect(c.grazed).toBeGreaterThan(-8);
        expect(c.grazed).toBeLessThanOrEqual(0);
      }
      if (c.land === 'forest') expect(c).toMatchObject({ food: 1 });
      if (c.land === 'steppe') expect(c).toMatchObject({ food: 1, age: 0 });
    }
  });

  it('gleicher Seed → gleiche Partie; Text-Seeds gehen auch', () => {
    expect(newGame(data, { seed: 'abc' })).toEqual(newGame(data, { seed: 'abc' }));
    expect(newGame(data, { seed: 1 })).not.toEqual(newGame(data, { seed: 2 }));
  });

  it('unbekannte Insel', () => {
    expect(() => newGame(data, { seed: 1, island: 'atlantis' })).toThrow(RuleError);
  });
});

describe('step', () => {
  it('ist rein: der Eingangszustand bleibt unverändert', () => {
    const s = newGame(data, { seed: 3 });
    const copy = structuredClone(s);
    step(data, s, { type: 'advance' });
    step(data, s, legalPlays(data, s)[0]!);
    expect(s).toEqual(copy);
  });

  it('ein Monat zählt weiter; Spielstände sind reines JSON', () => {
    const s = newGame(data, { seed: 3 });
    const r = step(data, s, { type: 'advance' });
    expect(r.state.month).toBe(1);
    expect(r.state.wild).toBe(8.5);
    expect(JSON.parse(JSON.stringify(r.state))).toEqual(r.state);
  });

  it('unbekannte Aktion', () => {
    expect(() => step(data, newGame(data, { seed: 1 }), { type: 'jump' } as never)).toThrow(/Unbekannte Aktion/);
  });
});

describe('Wildnis und Eiszeit (Konzept 8)', () => {
  /** Herde mit Schutz und Futter für ein paar Wintermonate. */
  function shelteredHerd(): HerdeState {
    const s = season(blank(), 2, 0);
    s.herd.size = 2;
    s.herd.fat = 4;
    for (const [dx, dy] of NEIGHBORS) put(s, 3 + dx, 3 + dy, 'bush', { food: 2 });
    return s;
  }

  it('Wildnis wächst jeden Monat und mit jeder Karte', () => {
    const s = season(blank(), 2);
    s.hand = ['rock'];
    const played = step(data, s, { type: 'play', hand: 0, x: 0, y: 0 }).state;
    expect(played.wild).toBe(s.wild + 1);
    expect(advance(played).state.wild).toBe(s.wild + 1.5);
  });

  it('bei 100 beginnt die Eiszeit: 6 Monate Winter, kein Nachwuchs, dann Sieg', () => {
    let s = shelteredHerd();
    s.wild = 99.5;
    let r = advance(s);
    expect(r.state.ice).toBe(6);
    expect(ofType(r.events, 'iceAgeBegan')).toEqual([{ type: 'iceAgeBegan', months: 6 }]);
    s = r.state;
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      const v = view(data, s);
      months.push(v.season);
      expect(v.ice).toEqual({ active: true, monthsLeft: 6 - i, months: 6 });
      r = advance(s);
      expect(ofType(r.events, 'herdBorn')).toEqual([]);
      s = r.state;
    }
    expect(months).toEqual(Array(6).fill('winter'));
    expect(s.over).toBe('won');
    expect(ofType(r.events, 'iceAgeEnded')).toEqual([{ type: 'iceAgeEnded', survivors: 2 }]);
    expect(ofType(r.events, 'gameWon')).toEqual([{ type: 'gameWon', survivors: 2 }]);
    expect(view(data, s)).toMatchObject({ over: 'won', intent: null });
    expect(legalPlays(data, s)).toEqual([]);
    expect(() => advance(s)).toThrow(/vorbei/);
  });

  it('in der Eiszeit friert die Herde ohne Schutz, auch im Sommer', () => {
    const s = season(blank(), 1);
    s.ice = 3;
    s.herd.fat = 20;
    const r = advance(s);
    expect(ofType(r.events, 'herdFroze')).toHaveLength(1);
    expect(ofType(r.events, 'herdThirsted')).toEqual([]);
  });

  it('stirbt die Herde aus, ist die Partie verloren', () => {
    const s = season(blank(), 2);
    s.herd.size = 1;
    s.herd.fat = 0;
    const r = advance(s);
    expect(r.state.over).toBe('lost');
    expect(ofType(r.events, 'gameLost')).toEqual([{ type: 'gameLost', month: s.month }]);
    expect(ofType(r.events, 'seasonBegan')).toEqual([]);
    expect(() => step(data, r.state, { type: 'play', hand: 0, x: 0, y: 0 })).toThrow(RuleError);
  });

  it('stirbt sie im letzten Eiszeit-Monat, ist es kein Sieg', () => {
    const s = season(blank(), 2);
    s.ice = 1;
    s.herd.size = 1;
    s.herd.fat = 0;
    const r = advance(s);
    expect(r.state.over).toBe('lost');
    expect(ofType(r.events, 'gameWon')).toEqual([]);
  });

  it('Wölfe reißen nicht mehr Tiere, als die Herde hat', () => {
    const s = season(blank(), 2);
    s.herd.size = 1;
    s.herd.fat = 2;
    for (const [dx, dy] of NEIGHBORS) put(s, 3 + dx, 3 + dy, 'rock');
    put(s, 2, 2, 'forest', { food: 0 });
    put(s, 3, 3, 'forest', { food: 0 });
    addPack(s, 3, 3, 3);
    addPack(s, 2, 2, 3);
    const r = advance(s);
    expect(r.state.herd).toMatchObject({ x: 3, y: 3 });
    expect(ofType(r.events, 'wolvesHunted')).toEqual([{ type: 'wolvesHunted', pack: 1, killed: 1 }]);
    expect(r.state.herd.size).toBe(0);
  });
});

describe('view', () => {
  it('liefert Raster, Herde, Rudel, Absicht, Hand, Datum', () => {
    const s = newGame(data, { seed: 11 });
    const v = view(data, s);
    expect(v).toMatchObject({
      island: 'start',
      width: 7,
      height: 9,
      month: 0,
      year: 1,
      monthOfYear: 0,
      season: 'spring',
      ice: { active: false, monthsLeft: 0, months: 6 },
      wild: { value: 8, max: 100 },
      herd: { stage: 'herd', x: 1, y: 5, size: 10, fat: 10, fatMax: 20, thirst: 0 },
      packs: [{ id: 1, x: 5, y: 2, size: 1, hungry: false }],
      handMax: 5,
      over: null,
    });
    expect(v.cells).toHaveLength(63);
    expect(v.cells[5 * 7 + 1]).toMatchObject({ herd: true, land: 'meadow', walkable: true });
    expect(v.cells[2 * 7 + 5]).toMatchObject({ pack: 1, land: 'old', wildfire: true, forecast: null });
    expect(v.cells[0]).toMatchObject({ land: 'sea', walkable: false, maxFood: 0 });
    expect(v.hand).toHaveLength(3);
    for (const h of v.hand) expect(h.global || h.targets.length > 0).toBe(true);
    expect(v.intent).not.toBeNull();
  });

  it('hungrige Rudel sind markiert', () => {
    const s = season(blank(), 2);
    put(s, 0, 0, 'forest');
    addPack(s, 0, 0, 1, { hungry: 2 });
    expect(view(data, s).packs[0]!.hungry).toBe(true);
  });
});

describe('validateState', () => {
  const fresh = () => newGame(data, { seed: 9 });
  const broken = (fn: (s: HerdeState) => void) => {
    const s = fresh();
    fn(s);
    return validateState(data, s);
  };

  it('frische und gespeicherte Stände sind gültig', () => {
    expect(validateState(data, fresh())).toEqual({ ok: true });
    let s = fresh();
    for (let i = 0; i < 30 && !s.over; i++) s = advance(s).state;
    expect(validateState(data, JSON.parse(JSON.stringify(s)))).toEqual({ ok: true });
  });

  it.each([
    ['kein Objekt', null, /kein Spielstand/],
    ['Liste', [], /kein Spielstand/],
    ['alte Version', { version: 0 }, /Version 0/],
  ])('%s', (_, value, reason) => {
    expect(validateState(data, value)).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
  });

  it.each<[string, (s: HerdeState) => void, RegExp]>([
    ['Format', (s) => (s.cells[0]!.food = -1), /Format: cells.0.food/],
    ['fremdes Feld', (s) => ((s as unknown as Record<string, unknown>).extra = 1), /Format/],
    ['unbekannte Insel', (s) => (s.island = 'atlantis'), /Insel/],
    ['Felderzahl', (s) => s.cells.pop(), /62 Felder/],
    ['Landschaft', (s) => (s.cells[3]!.land = 'lava'), /Landschaft lava/],
    ['Stufe', (s) => (s.herd.stage = 'human'), /Stufe human/],
    ['Herde außerhalb', (s) => (s.herd.x = 7), /außerhalb/],
    ['Herde auf Fels', (s) => (s.cells[5 * 7 + 1]!.land = 'rock'), /unbegehbar/],
    ['Vorrat', (s) => (s.herd.fat = 99), /Vorrat/],
    ['Spur', (s) => (s.herd.trail = Array(5).fill({ x: 0, y: 0 })), /Spur länger/],
    ['Spur außerhalb', (s) => (s.herd.trail = [{ x: 9, y: 9 }]), /Spur außerhalb/],
    ['Rudel außerhalb', (s) => (s.packs[0]!.y = 9), /Rudel 1 außerhalb/],
    ['Rudel zu stark', (s) => (s.packs[0]!.size = 4), /stärker/],
    ['Rudel-Id doppelt', (s) => s.packs.push({ ...s.packs[0]!, x: 4, y: 1 }), /Rudel-Id 1 doppelt/],
    ['Rudel nicht im Gehölz', (s) => (s.packs[0]!.x = 0), /nicht im Gehölz/],
    ['zwei Rudel auf einem Feld', (s) => s.packs.push({ ...s.packs[0]!, id: s.nextPackId++ }), /zwei Rudel/],
    ['Rudel-Id zu groß', (s) => (s.nextPackId = 1), /nextPackId/],
    ['Karte', (s) => (s.hand[0] = 'meteor'), /Karte meteor/],
    ['Hand zu voll', (s) => (s.hand = Array(6).fill('rain')), /6 Karten/],
    ['Eiszeit', (s) => (s.ice = 7), /Eiszeit/],
  ])('erkennt: %s', (_, fn, reason) => {
    expect(broken(fn)).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
  });

  it('wirft nie', () => {
    const evil = new Proxy(
      { version: STATE_VERSION },
      {
        get(t, k) {
          if (k === 'cells') throw new Error('böse');
          return Reflect.get(t, k);
        },
      },
    );
    expect(validateState(data, evil)).toMatchObject({ ok: false });
  });
});

describe('Zufalls-Bot (Absturz-Test)', () => {
  it('spielt Partien bis zum Ende, jeder Zustand ist gültig', () => {
    for (const seed of [1, 2, 3]) {
      const r = playRandomGame(data, { seed, check: true });
      expect(r.outcome).not.toBeNull();
      expect(r.months).toBeGreaterThan(0);
    }
  });

  it('bricht nach maxMonths ab', () => {
    const r = playRandomGame(data, { seed: 1, maxMonths: 5, playChance: 0 });
    expect(r).toMatchObject({ outcome: null, months: 5, plays: 0 });
  });
});
