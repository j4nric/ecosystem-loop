/**
 * Konzept 9.1/9.2 (H3a): Erfahrungen, Angebote und Wahl von Merkmalen, ihre Wirkung, Reife und Sprung,
 * Bedürfnisse der Stufen 2 (Waldsammler) und 3 (Wanderer).
 */
import { describe, expect, it } from 'vitest';
import {
  legalActions,
  playRandomGame,
  RuleError,
  step,
  validateState,
  view,
  type HerdeData,
  type HerdeState,
} from '../src/index.ts';
import { act, addPack, advance, at, blank, data, ofType, put, season, tweak } from './helpers.ts';

const exp = (s: HerdeState) => s.herd.experience;
/** Konstruierter Zustand in einer Stufe mit Merkmalen. */
function inStage(stage: string, traits: string[] = [], s = blank()): HerdeState {
  s.herd.stage = stage;
  s.herd.traits = [...traits];
  return s;
}
const run = (d: HerdeData, s: HerdeState) => step(d, s, { type: 'advance' });

describe('Erfahrungen (Zähler je Monat)', () => {
  it('sheltered: Schutz in der Nähe in einer Kälte-Jahreszeit der Stufe', () => {
    const s = season(blank(), 3);
    s.herd.fat = 20;
    put(s, 3, 3, 'bush', { food: 0 });
    expect(exp(advance(s).state).sheltered).toBe(1);
    // Im Herbst braucht Stufe 1 keinen Schutz: zählt nicht.
    const autumn = season(blank(), 2);
    put(autumn, 3, 3, 'bush', { food: 0 });
    expect(exp(advance(autumn).state).sheltered).toBe(0);
  });

  it('watered: Wasser in der Nähe, wenn die Stufe Wasser braucht (Sammler auch im Frühling)', () => {
    const summer = season(blank(), 1);
    put(summer, 3, 4, 'river');
    expect(exp(advance(summer).state).watered).toBe(1);
    const spring = season(blank(), 0);
    put(spring, 3, 4, 'river');
    expect(exp(advance(spring).state).watered).toBe(0);
    const gatherer = inStage('gatherer', [], season(blank(), 0));
    put(gatherer, 3, 4, 'river');
    expect(exp(advance(gatherer).state).watered).toBe(1);
  });

  it('hunted: Wölfe haben gerissen, die Herde lebt', () => {
    // Rudel auf dem Feld der Herde: Sie kann ihm in einem Schritt nicht entkommen.
    const s = season(blank(), 2);
    put(s, 3, 3, 'bush');
    addPack(s, 3, 3, 1);
    expect(exp(advance(s).state).hunted).toBe(1);
  });

  it('fire: Waldbrand am Feld der Herde oder daneben', () => {
    const d = tweak((x) => {
      x.landscapes.get('old')!.fireChance = 1;
      x.params.fire.spread = 0;
    });
    const s = season(blank(), 1);
    s.herd.fat = 20;
    put(s, 4, 3, 'old');
    const r = run(d, s);
    expect(ofType(r.events, 'fire')).toHaveLength(1);
    expect(exp(r.state).fire).toBe(1);
    const far = season(blank(), 1);
    put(far, 0, 0, 'old');
    expect(exp(run(d, far).state).fire).toBe(0);
  });

  it('ate: auf Gehölz gefressen · on: auf offener Fläche · moved: gegangene Felder', () => {
    const forest = season(blank(), 2);
    put(forest, 3, 3, 'forest', { food: 1 });
    const r = advance(forest).state;
    expect(r.herd).toMatchObject({ x: 3, y: 3 });
    expect(exp(r)).toMatchObject({ forest: 1, open: 0, walked: 0 });
    // Ohne Futter kein „gefressen“.
    const hungry = season(blank(), 2);
    hungry.herd.fat = 20;
    put(hungry, 3, 3, 'forest', { food: 0 });
    expect(exp(advance(hungry).state).forest).toBe(0);
    const open = season(blank(), 2);
    put(open, 5, 3, 'meadow', { food: 6, grazed: open.month });
    const moved = advance(open).state;
    expect(moved.herd).toMatchObject({ x: 4 });
    expect(exp(moved)).toMatchObject({ open: 1, walked: 1 });
  });

  it('eine tote Herde sammelt nichts', () => {
    const s = season(blank(), 3);
    s.herd.size = 1;
    s.herd.fat = 0;
    expect(Object.values(exp(advance(s).state)).every((v) => v === 0)).toBe(true);
  });
});

describe('Angebot und Wahl', () => {
  /** letzter Monat einer Jahreszeit: der nächste Schritt beginnt eine neue */
  const beforeSeason = () => season(blank(), 2, 2);

  it('zu Beginn einer Jahreszeit: verfügbare Merkmale in Daten-Reihenfolge, höchstens offerSize', () => {
    const s = beforeSeason();
    s.herd.fat = 20;
    for (const id of data.experiences.keys()) s.herd.experience[id] = 99;
    const r = advance(s);
    expect(ofType(r.events, 'traitOffered')).toEqual([
      { type: 'traitOffered', traits: ['thick_fur', 'vigilant', 'frugal'] },
    ]);
    expect(r.state.herd.offer).toEqual(['thick_fur', 'vigilant', 'frugal']);
    // Mitten in der Jahreszeit kein Angebot.
    const mid = season(blank(), 2, 0);
    mid.herd.experience.forest = 9;
    expect(advance(mid).state.herd.offer).toEqual([]);
  });

  it('ohne erreichte Schwelle kein Angebot; ein stehendes Angebot wird nur bei Änderung neu gemeldet', () => {
    const none = beforeSeason();
    expect(ofType(advance(none).events, 'traitOffered')).toEqual([]);
    const s = beforeSeason();
    s.herd.experience.forest = 4;
    let r = advance(s);
    expect(r.state.herd.offer).toEqual(['forest_wise']);
    // Eine Jahreszeit später, Angebot unverändert: kein neues Ereignis.
    let st = r.state;
    for (let i = 0; i < 3; i++) {
      st.herd.fat = 20;
      r = advance(st);
      st = r.state;
      if (i < 2) continue;
      expect(ofType(r.events, 'traitOffered')).toEqual([]);
    }
    // Neue Schwelle erreicht: erneuertes Angebot.
    st.month += 2;
    st.herd.experience.sheltered = 3;
    r = advance(st);
    expect(ofType(r.events, 'traitOffered')).toEqual([{ type: 'traitOffered', traits: ['thick_fur', 'forest_wise'] }]);
  });

  it('pickTrait: nur ein angebotenes Merkmal; das Angebot ist danach verbraucht', () => {
    const s = blank();
    s.herd.experience.sheltered = 3;
    s.herd.experience.hunted = 2;
    s.herd.offer = ['thick_fur', 'vigilant'];
    expect(legalActions(data, s)).toEqual(
      expect.arrayContaining([
        { type: 'pickTrait', trait: 'thick_fur' },
        { type: 'pickTrait', trait: 'vigilant' },
        { type: 'advance' },
      ]),
    );
    expect(() => act(s, { type: 'pickTrait', trait: 'frugal' })).toThrow(RuleError);
    const r = act(s, { type: 'pickTrait', trait: 'vigilant' });
    expect(r.events).toEqual([{ type: 'traitPicked', trait: 'vigilant' }]);
    expect(r.state.herd).toMatchObject({ traits: ['vigilant'], offer: [] });
    expect(s.herd.traits).toEqual([]); // rein
    expect(legalActions(data, r.state).some((a) => a.type === 'pickTrait')).toBe(false);
    // Zur nächsten Jahreszeit kommt das übrige Merkmal wieder ins Angebot.
    const next = season(r.state, 2, 2);
    expect(advance(next).state.herd.offer).toEqual(['thick_fur']);
  });
});

describe('Wirkung der Merkmale', () => {
  /** Toten eines Ereignistyps nach einem Monat, mit und ohne Merkmal. */
  const deaths = (
    type: 'herdFroze' | 'herdThirsted' | 'herdStarved' | 'herdBurned',
    trait: string,
    setup: (s: HerdeState) => void,
    d: HerdeData = data,
  ) =>
    [[], [trait]].map((traits) => {
      const s = inStage('herd', traits);
      setup(s);
      return ofType(run(d, s).events, type).reduce((a, e) => a + e.dead, 0);
    });

  it('Dichtes Fell: Kälteverlust halbiert', () => {
    expect(
      deaths('herdFroze', 'thick_fur', (s) => {
        season(s, 3);
        Object.assign(s.herd, { size: 40, fat: 80 });
      }),
    ).toEqual([4, 2]);
  });

  it('Wachsamkeit: jedes Rudel reißt ein Tier weniger; ein schwaches Rudel wird ganz abgewehrt', () => {
    const kills = (size: number, traits: string[]) => {
      const s = inStage('herd', traits, season(blank(), 2));
      put(s, 3, 3, 'bush');
      addPack(s, 3, 3, size);
      const r = advance(s);
      return { killed: ofType(r.events, 'wolvesHunted').map((e) => e.killed), hungry: r.state.packs[0]?.hungry };
    };
    expect(kills(2, [])).toEqual({ killed: [2], hungry: 0 });
    expect(kills(2, ['vigilant'])).toEqual({ killed: [1], hungry: 0 });
    expect(kills(1, ['vigilant'])).toEqual({ killed: [], hungry: 1 });
  });

  it('Genügsam: Durst einen Monat später', () => {
    expect(
      deaths('herdThirsted', 'frugal', (s) => {
        season(s, 1);
        s.herd.thirst = 1;
      }),
    ).toEqual([1, 0]);
  });

  it('Feuerscheu: Brandverlust halbiert', () => {
    const d = tweak((x) => {
      x.landscapes.get('old')!.fireChance = 1;
      x.params.fire.spread = 0;
    });
    const setup = (s: HerdeState) => {
      season(s, 1);
      Object.assign(s.herd, { size: 40, fat: 80 });
      put(s, 3, 3, 'old');
    };
    expect(deaths('herdBurned', 'fire_wary', setup, d)).toEqual([8, 4]);
  });

  it('Waldkundig: Vorratsdeckel + 1', () => {
    expect(view(data, inStage('herd')).herd.fatMax).toBe(20);
    expect(view(data, inStage('herd', ['forest_wise'])).herd.fatMax).toBe(30);
  });

  it('Weitblick: Durstverlust halbiert', () => {
    expect(
      deaths('herdThirsted', 'far_sight', (s) => {
        season(s, 1);
        Object.assign(s.herd, { size: 40, fat: 80, thirst: 5 });
      }),
    ).toEqual([4, 2]);
  });

  it('Ausdauer: halb so viele Hungertote', () => {
    expect(
      deaths('herdStarved', 'endurance', (s) => {
        season(s, 2);
        s.herd.fat = 0;
      }),
    ).toEqual([5, 3]);
  });

  it('ganzzahlige Werte werden gerundet und haben Untergrenzen; Merkmale wirken nacheinander', () => {
    const d = tweak((x) => {
      const base = { name: { de: 'T', en: 'T' }, text: { de: 'T', en: 'T' }, icon: '', from: 'open', at: 1 };
      x.traits.set('stride', { ...base, id: 'stride', effects: [{ stat: 'reach', add: 1 }] });
      x.traits.set('parched', { ...base, id: 'parched', effects: [{ stat: 'thirstAfter', mul: 0 }] });
    });
    // Umkreis 2: Futter drei Felder entfernt wird nach einem Schritt erreicht.
    const eaten = (traits: string[]) => {
      const s = inStage('herd', traits, season(blank(), 2));
      put(s, 6, 3, 'meadow', { food: 6, grazed: s.month });
      return ofType(run(d, s).events, 'herdAte')[0]!.eaten;
    };
    expect(eaten([])).toBe(0);
    expect(eaten(['stride'])).toBe(6);
    // thirstAfter × 0 → mindestens 1: schon der erste Monat ohne Wasser kostet Tiere.
    const s = inStage('herd', ['parched'], season(blank(), 1));
    expect(ofType(run(d, s).events, 'herdThirsted')).toHaveLength(1);
  });
});

describe('Reife und Sprung', () => {
  it('Stufe 1 braucht zwei Merkmale, darunter Waldkundig', () => {
    const s = inStage('herd', ['thick_fur']);
    expect(view(data, s).evolution).toMatchObject({ mature: false, missing: { traits: 1, oneOf: ['forest_wise'] } });
    expect(() => act(s, { type: 'evolve' })).toThrow(RuleError);
    expect(legalActions(data, s)).not.toContainEqual({ type: 'evolve' });
    const two = inStage('herd', ['thick_fur', 'vigilant']);
    expect(view(data, two).evolution).toMatchObject({ mature: false, missing: { traits: 0, oneOf: ['forest_wise'] } });
  });

  it('die Wahl, die reif macht, meldet matured', () => {
    const s = inStage('herd', ['thick_fur']);
    s.herd.experience.forest = 4;
    s.herd.offer = ['forest_wise'];
    const r = act(s, { type: 'pickTrait', trait: 'forest_wise' });
    expect(r.events).toEqual([
      { type: 'traitPicked', trait: 'forest_wise' },
      { type: 'matured', stage: 'herd', next: 'gatherer' },
    ]);
    expect(view(data, r.state).evolution).toMatchObject({ mature: true, missing: { traits: 0, oneOf: null } });
    expect(legalActions(data, r.state)).toContainEqual({ type: 'evolve' });
  });

  it('evolve: Sprung zur Folgestufe, Merkmale bleiben, kein Rückweg', () => {
    const s = inStage('herd', ['thick_fur', 'forest_wise']);
    const r = act(s, { type: 'evolve' });
    expect(r.events).toEqual([{ type: 'herdEvolved', from: 'herd', to: 'gatherer' }]);
    expect(r.state.herd).toMatchObject({ stage: 'gatherer', traits: ['thick_fur', 'forest_wise'] });
    expect(s.herd.stage).toBe('herd'); // rein
    const v = view(data, r.state).evolution;
    expect(v).toMatchObject({ mature: false, missing: { traits: 1, oneOf: ['far_sight', 'endurance'] } });
    expect(v.next?.id).toBe('wanderer');
    // Keine Aktion führt zurück; ein zweiter Sprung braucht neue Reife.
    expect(() => act(r.state, { type: 'evolve' })).toThrow(RuleError);
    expect(legalActions(data, r.state).every((a) => a.type === 'play' || a.type === 'advance')).toBe(true);
  });

  it('ist die neue Stufe schon reif, folgt matured direkt', () => {
    const s = inStage('herd', ['forest_wise', 'thick_fur', 'endurance']);
    expect(act(s, { type: 'evolve' }).events).toEqual([
      { type: 'herdEvolved', from: 'herd', to: 'gatherer' },
      { type: 'matured', stage: 'gatherer', next: 'wanderer' },
    ]);
  });

  it('letzte Stufe (H3a: Wanderer): keine Reife, keine Vorschau', () => {
    const s = inStage('wanderer', ['forest_wise', 'thick_fur', 'endurance']);
    expect(view(data, s).evolution).toMatchObject({ mature: false, missing: null, next: null });
    expect(() => act(s, { type: 'evolve' })).toThrow(RuleError);
  });

  it('nach dem Sprung gelten Spur, Vorratsdeckel und Futter-Maximum der neuen Stufe', () => {
    const d = tweak((x) => (x.stages.get('wanderer')!.trail = 1));
    const s = inStage('gatherer', ['thick_fur', 'forest_wise', 'endurance']);
    s.herd.trail = [
      { x: 2, y: 3 },
      { x: 2, y: 2 },
    ];
    s.herd.fat = 30;
    put(s, 0, 0, 'forest', { food: 4 });
    const r = step(d, s, { type: 'evolve' }).state;
    expect(r.herd.trail).toEqual([{ x: 2, y: 2 }]);
    expect(r.herd.fat).toBe(30); // Waldkundig: Deckel 3 × 10
    expect(at(r, 0, 0).food).toBe(1);
  });
});

describe('Stufe 2: Waldsammler', () => {
  it('Früchte: Gehölz wächst bis zum Maximum der Stufe, Wiese ist kein Futter', () => {
    const s = inStage('gatherer', [], season(blank(), 1));
    s.herd.fat = 20;
    put(s, 3, 4, 'river');
    put(s, 0, 0, 'forest', { food: 0 });
    put(s, 4, 3, 'meadow', { food: 6, grazed: s.month });
    const r = advance(s);
    expect(at(r.state, 0, 0).food).toBe(2);
    expect(view(data, r.state).cells[0]).toMatchObject({ land: 'forest', maxFood: 4 });
    expect(ofType(r.events, 'herdAte')[0]!.eaten).toBe(0);
    // Stufe 1: Wald fasst nur 1.
    expect(view(data, inStage('herd', [], r.state)).cells[0]).toMatchObject({ maxFood: 1 });
  });

  it('die Absicht folgt dem Wald, nicht der Wiese', () => {
    const make = (stage: string) => {
      const s = inStage(stage, [], season(blank(), 2));
      put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
      put(s, 1, 3, 'forest', { food: 3 });
      return view(data, s).intent;
    };
    expect(make('gatherer')).toMatchObject({ x: 2, reason: 'freshGrass' });
    expect(make('herd')).toMatchObject({ x: 4 });
  });

  it('Wasser ganzjährig: Durst und Wassersuche auch im Frühling', () => {
    const thirsty = inStage('gatherer', [], season(blank(), 0));
    thirsty.herd.thirst = 1;
    expect(ofType(advance(thirsty).events, 'herdThirsted')).toHaveLength(1);
    const herd = inStage('herd', [], season(blank(), 0));
    herd.herd.thirst = 1;
    expect(ofType(advance(herd).events, 'herdThirsted')).toHaveLength(0);
    const seek = inStage('gatherer', [], season(blank(), 0));
    put(seek, 5, 3, 'river');
    expect(view(data, seek).intent).toMatchObject({ x: 4, reason: 'seekWater' });
  });
});

describe('Stufe 3: Wanderer der offenen Landschaft', () => {
  it('zieht bis zu 2 Felder im Monat', () => {
    const s = inStage('wanderer', [], season(blank(), 2));
    put(s, 6, 3, 'meadow', { food: 6, grazed: s.month });
    expect(view(data, s).intent).toMatchObject({ dx: 2, reason: 'freshGrass' });
    const r = advance(s);
    const moved = ofType(r.events, 'herdMoved')[0]!;
    expect(moved.to.x - moved.from.x).toBe(2);
    expect(exp(r.state).walked).toBe(2);
    // Stufe 1 zieht nur ein Feld: Von dort erreicht sie die Wiese nicht und bleibt.
    const herd = inStage('herd', [], season(blank(), 2));
    put(herd, 6, 3, 'meadow', { food: 6, grazed: herd.month });
    expect(view(data, herd).intent).toMatchObject({ stays: true });
  });

  it('Altwald ist ein Hindernis: nicht betreten, nicht durchqueren', () => {
    const make = (stage: string) => {
      const s = inStage(stage, [], season(blank(), 2));
      for (let y = 0; y < 7; y++) put(s, 4, y, 'old');
      put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
      return s;
    };
    expect(view(data, make('wanderer')).intent!.x).toBeLessThan(4);
    expect(view(data, make('wanderer')).cells[4]).toMatchObject({ land: 'old', walkable: true, blocked: true });
    expect(view(data, make('herd')).intent).toMatchObject({ x: 4 });
    expect(view(data, make('herd')).cells[4]).toMatchObject({ blocked: false });
  });

  it('Fels wird nicht übersprungen', () => {
    const s = inStage('wanderer', [], season(blank(), 2));
    for (let y = 0; y < 7; y++) put(s, 4, y, 'rock');
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    expect(view(data, s).intent!.x).toBeLessThan(4);
  });

  it('steht die Herde nach dem Sprung im Altwald, kann sie bleiben oder hinaus', () => {
    const s = inStage('wanderer', [], season(blank(), 2));
    put(s, 3, 3, 'old');
    expect(view(data, s).intent).toMatchObject({ stays: true });
    put(s, 5, 3, 'meadow', { food: 6, grazed: s.month });
    expect(view(data, s).intent!.x).toBeGreaterThan(3);
  });
});

describe('view: Entwicklung', () => {
  it('Stufe, Bedürfnisse, Vorschau der nächsten Stufe, Fortschritt', () => {
    const s = blank();
    s.herd.experience.forest = 4;
    const v = view(data, s).evolution;
    expect(v.stage).toMatchObject({
      id: 'herd',
      eats: ['steppe', 'meadow', 'bush', 'forest'],
      food: { steppe: 1, meadow: 6, bush: 2, forest: 1 },
      waterSeasons: ['summer'],
      shelterSeasons: ['winter'],
      blocked: [],
      move: 1,
      reach: 1,
    });
    expect(v.next).toMatchObject({
      id: 'gatherer',
      eats: ['bush', 'forest', 'old'],
      food: { bush: 3, forest: 4, old: 3 },
      waterSeasons: ['spring', 'summer', 'autumn', 'winter'],
    });
    expect(v).toMatchObject({ traits: [], offer: [], available: ['forest_wise'], mature: false });
    expect(v.experience.find((e) => e.id === 'forest')).toEqual({ id: 'forest', value: 4, next: null });
    expect(v.experience.find((e) => e.id === 'sheltered')).toEqual({
      id: 'sheltered',
      value: 0,
      next: { trait: 'thick_fur', at: 3 },
    });
    const wanderer = view(data, inStage('wanderer')).evolution.stage;
    expect(wanderer).toMatchObject({ blocked: ['old'], move: 2 });
  });

  it('nach dem Ende ist kein Sprung mehr möglich', () => {
    const s = inStage('herd', ['thick_fur', 'forest_wise']);
    s.over = 'lost';
    expect(view(data, s).evolution.mature).toBe(false);
    expect(legalActions(data, s)).toEqual([]);
  });
});

describe('validateState: Entwicklung', () => {
  const broken = (fn: (s: HerdeState) => void) => {
    const s = blank();
    fn(s);
    return validateState(data, s);
  };

  it('ein Stand mit Merkmalen, Angebot und Stufe 3 ist gültig', () => {
    const s = inStage('wanderer', ['forest_wise', 'thick_fur']);
    s.herd.experience.hunted = 2;
    s.herd.offer = ['vigilant'];
    s.herd.fat = 30;
    expect(validateState(data, s)).toEqual({ ok: true });
  });

  it('Version 1 (vor H3a) wird abgelehnt', () => {
    const s = blank() as unknown as Record<string, unknown>;
    expect(validateState(data, { ...s, version: 1 })).toEqual({ ok: false, reason: 'Version 1 statt 2' });
  });

  it.each<[string, (s: HerdeState) => void, RegExp]>([
    ['Merkmal unbekannt', (s) => (s.herd.traits = ['wings']), /unbekanntes Merkmal wings/],
    ['Merkmal doppelt', (s) => (s.herd.traits = ['vigilant', 'vigilant']), /Merkmal doppelt/],
    ['Erfahrung unbekannt', (s) => (s.herd.experience.flight = 1), /unbekannte Erfahrung flight/],
    ['Erfahrung fehlt', (s) => delete s.herd.experience.fire, /Erfahrung fire fehlt/],
    ['Erfahrung negativ', (s) => (s.herd.experience.fire = -1), /Format: herd.experience.fire/],
    ['Angebot zu groß', (s) => (s.herd.offer = ['a', 'b', 'c', 'd']), /4 Merkmale im Angebot/],
    ['Angebot unbekannt', (s) => (s.herd.offer = ['wings']), /unbekanntes Merkmal wings im Angebot/],
    [
      'Angebot schon gewählt',
      (s) => {
        s.herd.traits = ['vigilant'];
        s.herd.offer = ['vigilant'];
        s.herd.experience.hunted = 2;
      },
      /schon gewählt/,
    ],
    ['Angebot unter der Schwelle', (s) => (s.herd.offer = ['vigilant']), /Schwelle nicht erreicht/],
    ['Vorrat über dem Deckel mit Merkmal', (s) => (s.herd.fat = 21), /Vorrat 21/],
  ])('erkennt: %s', (_, fn, reason) => {
    expect(broken(fn)).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
  });
});

describe('Zufalls-Bot', () => {
  it('wählt Merkmale und springt bis zur dritten Stufe', () => {
    const r = playRandomGame(data, { seed: 3, check: true });
    expect(r.stages).toEqual(['herd', 'gatherer', 'wanderer']);
    expect(r.state.herd.traits.length).toBeGreaterThanOrEqual(3);
  });
});
