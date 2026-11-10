/**
 * Konzept 9.2 (H3b): Wild, Wölfe bevorzugen Wild, Stufe 4 Jäger (Jagd, Feuer als Werkzeug, Wölfe als Konkurrenten),
 * Stufe 5 Mensch (Lager, sesshaft, Rodung), Eiszeiten als Prüfung unterwegs, Sieg und Niederlage, validateState.
 */
import { describe, expect, it } from 'vitest';
import {
  campPreview,
  legalActions,
  playRandomGame,
  RuleError,
  step,
  validateState,
  view,
  type HerdeData,
  type HerdeState,
} from '../src/index.ts';
import { eat } from '../src/herd.ts';
import type { HerdeEvent } from '../src/state.ts';
import { act, addPack, advance, at, blank, data, ofType, put, season, tweak } from './helpers.ts';

function addPrey(s: HerdeState, x: number, y: number, size = 1, extra: { fed?: number; hungry?: number } = {}) {
  const prey = { id: s.nextPreyId++, x, y, size, fed: extra.fed ?? 0, hungry: extra.hungry ?? 0 };
  s.prey.push(prey);
  return prey;
}

/** Herde in der Ecke unten links (weit weg vom Wild oben rechts), satt. */
function corner(seasonIndex: number): HerdeState {
  const s = season(blank(), seasonIndex);
  s.herd.x = 0;
  s.herd.y = 6;
  s.herd.fat = 20;
  return s;
}

function inStage(stage: string, s = blank()): HerdeState {
  s.herd.stage = stage;
  s.herd.fat = 20;
  return s;
}

const run = (d: HerdeData, s: HerdeState) => step(d, s, { type: 'advance' });
const ok = (s: HerdeState) => expect(validateState(data, s)).toEqual({ ok: true });

describe('Wild: Dynamik', () => {
  it('satt: nach fedToGrow Monaten wächst der Bestand', () => {
    const s = corner(2);
    put(s, 6, 0, 'meadow', { food: 6, grazed: s.month });
    addPrey(s, 6, 0, 1, { fed: data.params.prey.fedToGrow - 1 });
    const r = advance(s);
    expect(ofType(r.events, 'preyGrew')).toEqual([{ type: 'preyGrew', prey: 1, size: 2 }]);
    expect(r.state.prey[0]).toMatchObject({ size: 2, fed: 0, hungry: 0 });
    expect(at(r.state, 6, 0).food).toBe(5);
    ok(r.state);
  });

  it('in voller Größe gründet er einen neuen Bestand auf dem Nachbarfeld mit der meisten Weide', () => {
    const s = corner(2);
    put(s, 6, 0, 'meadow', { food: 6 });
    put(s, 5, 0, 'meadow', { food: 0 });
    put(s, 6, 1, 'meadow', { food: 0 });
    addPrey(s, 6, 0, 3, { fed: data.params.prey.fedToGrow - 1 });
    const r = advance(s);
    expect(ofType(r.events, 'preyFounded')).toEqual([{ type: 'preyFounded', prey: 2, parent: 1, x: 5, y: 0 }]);
    expect(r.state.prey.map((q) => [q.x, q.y, q.size])).toEqual([
      [6, 0, 3],
      [5, 0, 1],
    ]);
    expect(r.state.nextPreyId).toBe(3);
    ok(r.state);
  });

  it('hungrig: zieht zur besseren Weide und schrumpft nach starveAfter Monaten', () => {
    const s = corner(3);
    put(s, 6, 0, 'meadow', { food: 0 });
    put(s, 5, 1, 'meadow', { food: 2 });
    put(s, 4, 2, 'meadow', { food: 5 });
    addPrey(s, 6, 0, 3);
    const r = advance(s);
    expect(ofType(r.events, 'preyMoved')).toEqual([
      { type: 'preyMoved', prey: 1, from: { x: 6, y: 0 }, to: { x: 5, y: 1 } },
    ]);
    expect(r.state.prey[0]).toMatchObject({ x: 5, y: 1, hungry: 1, size: 3 });

    const starving = corner(3);
    addPrey(starving, 6, 0, 1, { hungry: data.params.prey.starveAfter - 1 });
    const r2 = advance(starving);
    expect(ofType(r2.events, 'preyStarved')).toEqual([{ type: 'preyStarved', prey: 1, size: 0 }]);
    expect(r2.state.prey).toEqual([]);
  });

  it('wird ein Feld unbegehbar, weicht Wild aus – ohne Ausweg verschwindet es', () => {
    const s = corner(2);
    put(s, 6, 0, 'meadow');
    put(s, 5, 0, 'meadow');
    addPrey(s, 6, 0, 2);
    s.hand = ['rock'];
    const r = act(s, { type: 'play', hand: 0, x: 6, y: 0 });
    expect(ofType(r.events, 'preyMoved')).toEqual([
      { type: 'preyMoved', prey: 1, from: { x: 6, y: 0 }, to: { x: 5, y: 0 } },
    ]);
    ok(r.state);
    const alone = corner(2);
    put(alone, 6, 0, 'meadow');
    addPrey(alone, 6, 0, 2);
    alone.hand = ['rock'];
    const r2 = act(alone, { type: 'play', hand: 0, x: 6, y: 0 });
    expect(ofType(r2.events, 'preyGone')).toEqual([{ type: 'preyGone', prey: 1, x: 6, y: 0 }]);
    expect(r2.state.prey).toEqual([]);
  });

  it('Einwandern erst ab der Stufe prey.from; davor bleibt auch der Zufall unberührt', () => {
    const d = tweak((x) => {
      x.params.prey.spawnChance = 1;
      x.params.prey.spawnMinLand = 1;
    });
    const s = corner(2);
    for (let x = 3; x < 7; x++) put(s, x, 0, 'meadow');
    const early = run(d, s).state;
    expect(early.prey).toEqual([]);
    expect(early.rng).toBe(advance(s).state.rng);

    const w = inStage('wanderer', corner(2));
    for (let x = 3; x < 7; x++) put(w, x, 0, 'meadow');
    const r = run(d, w);
    const [e] = ofType(r.events, 'preyImmigrated');
    expect(e).toMatchObject({ prey: 1, y: 0, size: data.params.prey.spawnSize });
    expect(r.state.prey).toHaveLength(1);
    // Mit Wild auf der Insel wandert keins ein; zu wenig Lebensraum: auch nicht.
    expect(ofType(run(d, r.state).events, 'preyImmigrated')).toEqual([]);
    const few = inStage('wanderer', corner(2));
    put(few, 6, 0, 'meadow');
    expect(
      run(
        tweak((x) => (x.params.prey.spawnChance = 1)),
        few,
      ).state.prey,
    ).toEqual([]);
  });
});

describe('Wölfe bevorzugen Wild', () => {
  it('ein Rudel mit Wild in Reichweite reißt Wild statt Tiere der Herde', () => {
    const s = season(blank(), 2);
    s.herd.fat = 20;
    put(s, 3, 3, 'bush');
    const pack = addPack(s, 3, 3, 2);
    addPrey(s, 4, 4, 2);
    const r = advance(s);
    expect(ofType(r.events, 'wolvesHunted')).toEqual([]);
    expect(ofType(r.events, 'packAtePrey')).toEqual([
      { type: 'packAtePrey', pack: pack.id, prey: 1, killed: data.params.wolves.preyKill, size: 1 },
    ]);
    expect(r.state.packs[0]).toMatchObject({ fed: data.params.wolves.preyFed, hungry: 0 });
    expect(r.state.herd.size).toBe(10);
    expect(r.state.herd.experience.hunted).toBe(0);
  });

  it('der größte Bestand zuerst; ist er aufgefressen, verschwindet er', () => {
    const s = season(blank(), 2);
    s.herd.fat = 20;
    put(s, 3, 3, 'bush');
    addPack(s, 3, 3, 1);
    addPrey(s, 2, 2, 1);
    addPrey(s, 4, 4, 3);
    const r = advance(s);
    expect(ofType(r.events, 'packAtePrey')[0]).toMatchObject({ prey: 2, size: 2 });
    const single = season(blank(), 2);
    single.herd.fat = 20;
    put(single, 3, 3, 'bush');
    addPack(single, 3, 3, 1);
    addPrey(single, 4, 4, 1);
    const r2 = advance(single);
    expect(ofType(r2.events, 'packAtePrey')[0]).toMatchObject({ prey: 1, size: 0 });
    expect(r2.state.prey).toEqual([]);
  });

  it('hungrige Rudel ziehen zum nächsten Wild statt zur Herde', () => {
    const s = season(blank(), 2);
    s.herd.x = 6;
    s.herd.y = 0;
    s.herd.fat = 20;
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const)
      put(s, x, y, 'forest');
    addPack(s, 0, 0, 1, { hungry: 5 });
    addPrey(s, 0, 3, 1);
    const r = advance(s);
    expect(ofType(r.events, 'packMoved')).toEqual([
      { type: 'packMoved', pack: 1, from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
    ]);
  });
});

describe('Stufe 4: Jäger und Sammler', () => {
  it('Jagd im Umkreis: die größten Bestände zuerst, höchstens huntKill; Gras ist kein Futter', () => {
    const s = inStage('hunter', season(blank(), 2));
    put(s, 3, 4, 'meadow', { food: 6 });
    addPrey(s, 5, 5, 1);
    addPrey(s, 1, 2, 3);
    addPrey(s, 4, 4, 2);
    addPrey(s, 6, 6, 3); // außer Reichweite (Umkreis 2)
    const events: HerdeEvent[] = [];
    eat(data, s, (e) => events.push(e));
    expect(ofType(events, 'preyHunted')).toEqual([{ type: 'preyHunted', prey: 2, killed: 2, size: 1, fire: false }]);
    expect(ofType(events, 'herdAte')).toEqual([{ type: 'herdAte', eaten: 8, need: 10, fat: 18 }]);
    expect(at(s, 3, 4).food).toBe(6);
    expect(s.prey.map((q) => q.size)).toEqual([1, 1, 2, 3]);
  });

  it('Feuer als Werkzeug: eine frische Brandfläche im Umkreis treibt Wild auf (fireHunt mehr)', () => {
    const s = inStage('hunter', season(blank(), 2));
    put(s, 2, 3, 'burnt', { age: 0 });
    addPrey(s, 1, 2, 3);
    addPrey(s, 4, 4, 2);
    const events: HerdeEvent[] = [];
    eat(data, s, (e) => events.push(e));
    expect(ofType(events, 'preyHunted')).toEqual([
      { type: 'preyHunted', prey: 1, killed: 3, size: 0, fire: true },
      { type: 'preyHunted', prey: 2, killed: 1, size: 1, fire: true },
    ]);
    expect(ofType(events, 'herdAte')[0]).toMatchObject({ eaten: 15 }); // gedeckelt auf den Appetit
    expect(s.prey).toEqual([expect.objectContaining({ id: 2, size: 1 })]);
    // Eine alte Brandfläche treibt kein Wild mehr auf.
    const old = inStage('hunter', season(blank(), 2));
    put(old, 2, 3, 'burnt', { age: data.params.fire.fresh + 1 });
    addPrey(old, 1, 2, 3);
    const ev2: HerdeEvent[] = [];
    eat(data, old, (e) => ev2.push(e));
    expect(ofType(ev2, 'preyHunted')).toEqual([{ type: 'preyHunted', prey: 1, killed: 2, size: 1, fire: false }]);
  });

  it('auch der Blitz zählt: Brandfläche aus der Karte bringt im nächsten Monat mehr', () => {
    const s = inStage('hunter', season(blank(), 2));
    put(s, 3, 3, 'river'); // Wasser: Die Herde bleibt
    put(s, 4, 3, 'bush');
    addPrey(s, 2, 2, 3);
    addPrey(s, 2, 4, 3);
    s.hand = ['lightning'];
    const played = act(s, { type: 'play', hand: 0, x: 4, y: 3 }).state;
    const r = advance(played);
    const hunted = ofType(r.events, 'preyHunted');
    expect(hunted.every((e) => e.fire)).toBe(true);
    expect(hunted.reduce((a, e) => a + e.killed, 0)).toBe(4);
    expect(r.state.herd.experience.fire_tamed).toBe(1);
  });

  it('kein Feuerverlust: brennt das Feld der Jäger, sterben keine Tiere (kein Ereignis)', () => {
    const d = tweak((x) => {
      x.landscapes.get('old')!.fireChance = 1;
      x.params.fire.spread = 0;
    });
    const s = inStage('hunter', season(blank(), 1));
    put(s, 3, 3, 'old');
    const r = run(d, s);
    expect(ofType(r.events, 'fire')).toHaveLength(1);
    expect(ofType(r.events, 'herdBurned')).toEqual([]);
    expect(r.state.herd.size).toBe(10);
    // Stufe 1 verliert Tiere – und das Feuer zählt dann nicht als „ohne Verlust überstanden“.
    const herd = season(blank(), 1);
    herd.herd.fat = 20;
    put(herd, 3, 3, 'old');
    const r2 = run(d, herd);
    expect(ofType(r2.events, 'herdBurned')).toHaveLength(1);
    expect(r2.state.herd.experience.fire_tamed).toBe(0);
    expect(r2.state.herd.experience.fire).toBe(1);
  });

  it('Wölfe sind Konkurrenten: sie greifen Jäger nicht an und ziehen ohne Wild nicht zu ihnen', () => {
    const s = inStage('hunter', season(blank(), 2));
    put(s, 3, 3, 'bush');
    put(s, 0, 0, 'forest');
    put(s, 1, 1, 'forest');
    addPack(s, 3, 3, 3);
    addPack(s, 0, 0, 1, { hungry: 5 });
    const r = advance(s);
    expect(ofType(r.events, 'wolvesHunted')).toEqual([]);
    expect(ofType(r.events, 'packMoved')).toEqual([]);
    expect(r.state.packs.map((p) => p.hungry)).toEqual([1, 6]);
    expect(r.state.herd.size).toBe(10);
  });

  it('die Herde zieht zum Wild (Futter in Reichweite zählt Beute mit)', () => {
    const s = inStage('hunter', season(blank(), 2));
    addPrey(s, 6, 3, 3);
    const r = advance(s);
    expect(r.state.herd.x).toBeGreaterThanOrEqual(4);
    expect(ofType(r.events, 'preyHunted')).toHaveLength(1);
  });

  it('Erfahrung „Monate nahe Wild“ (Spurenleser)', () => {
    const s = inStage('wanderer', season(blank(), 2));
    addPrey(s, 4, 4, 1);
    expect(advance(s).state.herd.experience.tracks).toBe(1);
    expect(advance(inStage('wanderer', season(blank(), 2))).state.herd.experience.tracks).toBe(0);
  });

  it('view: Beute als Bedürfnis, Wölfe als Konkurrenten, Wild je Feld', () => {
    const s = inStage('hunter', season(blank(), 2));
    addPrey(s, 5, 5, 2, { hungry: 1 });
    const v = view(data, s);
    expect(v.evolution.stage).toMatchObject({ prey: { food: 4, kill: 2, fire: 2 }, wolves: 'rival', camp: null });
    expect(v.evolution.next).toMatchObject({ id: 'human', camp: { radius: 1 } });
    expect(v.prey).toEqual([{ id: 1, x: 5, y: 5, size: 2, hungry: true, inReach: true }]);
    expect(v.cells.find((c) => c.x === 5 && c.y === 5)!.prey).toBe(1);
    expect(v.campSites).toEqual([]);
    const w = view(data, inStage('wanderer'));
    expect(w.evolution.stage).toMatchObject({ prey: null, wolves: 'enemy' });
    expect(w.evolution.next!.prey).toEqual({ food: 4, kill: 2, fire: 2 });
  });

  it('view: inReach – die Stufe jagt und das Wild liegt im Umkreis reach der Herde', () => {
    const s = inStage('hunter', season(blank(), 2));
    addPrey(s, 5, 5, 1); // Abstand 2 = reach
    addPrey(s, 6, 6, 1); // Abstand 3
    expect(view(data, s).prey.map((p) => p.inReach)).toEqual([true, false]);
    // Wanderer jagen nicht: nichts in Jagdweite.
    s.herd.stage = 'wanderer';
    expect(view(data, s).prey.map((p) => p.inReach)).toEqual([false, false]);
    // Merkmale wirken auf reach (wie in der Jagd).
    const d = tweak((x) => (x.stages.get('hunter')!.reach = 3));
    s.herd.stage = 'hunter';
    expect(view(d, s).prey.map((p) => p.inReach)).toEqual([true, true]);
  });
});

/** Mensch an einem gültigen Lagerplatz: Wasser (2,3), Wiese (4,3), Wald (3,2) um die Herde (3,3). */
function campSiteState(): HerdeState {
  const s = inStage('human', season(blank(), 2));
  put(s, 2, 3, 'river');
  put(s, 4, 3, 'meadow', { food: 6 });
  put(s, 3, 2, 'forest', { food: 4 });
  return s;
}

describe('Stufe 5: Mensch und Lager', () => {
  it('gültige Lagerplätze: Wasser, Wiese und Wald im Umkreis, in Zugweite', () => {
    const s = campSiteState();
    expect(view(data, s).campSites).toEqual([
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ]);
    expect(legalActions(data, s)).toEqual(
      expect.arrayContaining([
        { type: 'settle', x: 3, y: 2 },
        { type: 'settle', x: 3, y: 3 },
      ]),
    );
    expect(
      view(data, s)
        .cells.filter((c) => c.campSite)
        .map((c) => [c.x, c.y]),
    ).toEqual([
      [3, 2],
      [3, 3],
    ]);
    // Ohne Wald kein Lagerplatz.
    const noWood = campSiteState();
    put(noWood, 3, 2, 'steppe');
    expect(view(data, noWood).campSites).toEqual([]);
  });

  it('kein Lager auf dem Fluss: nur Landschaften aus camp.on (datengetrieben)', () => {
    const s = campSiteState();
    put(s, 2, 4, 'meadow'); // jetzt hätte auch der Fluss (2,3) Wasser, Wiese und Wald im Umkreis
    expect(view(data, s).campSites).not.toContainEqual({ x: 2, y: 3 });
    expect(() => act(s, { type: 'settle', x: 2, y: 3 })).toThrow(/kein gültiger Lagerplatz/);
    const d = tweak((x) => x.stages.get('human')!.camp!.on.push('river'));
    expect(view(d, s).campSites).toContainEqual({ x: 2, y: 3 });
  });

  it('view: Lager der Stufe mit Plätzen auf der Insel (ohne Zugweite) und Rodung, auch als Vorschau', () => {
    const s = campSiteState();
    s.herd.x = 0;
    s.herd.y = 6; // außer Zugweite
    const v = view(data, s);
    expect(v.campSites).toEqual([]);
    expect(v.evolution.stage.camp).toEqual({
      on: ['steppe', 'meadow', 'bush', 'forest', 'old', 'burnt'],
      radius: 1,
      near: [['river'], ['meadow'], ['forest', 'old']],
      spots: 2,
      clear: { lands: ['old', 'forest'], to: 'meadow', month: 2 },
    });
    // Vorschau der nächsten Stufe: Plätze für den Menschen schon auf der Jäger-Stufe
    s.herd.stage = 'hunter';
    expect(view(data, s).evolution.next!.camp).toMatchObject({ spots: 2 });
    expect(view(data, s).evolution.stage.camp).toBeNull();
  });

  it('campPreview: Felder je Gruppe, Umkreis reach, nächstes Rodungsfeld', () => {
    const s = campSiteState();
    put(s, 4, 4, 'old');
    put(s, 2, 2, 'forest');
    addPrey(s, 5, 5, 1);
    addPrey(s, 6, 6, 1);
    const p = campPreview(data, s, { x: 3, y: 3 })!;
    expect(p).toEqual({
      x: 3,
      y: 3,
      valid: true,
      radius: 1,
      near: [
        { lands: ['river'], count: 1 },
        { lands: ['meadow'], count: 1 },
        { lands: ['forest', 'old'], count: 3 },
      ],
      reach: 2,
      food: 25 - 2, // alles außer Fluss und Altwald
      water: 1,
      shelter: 3,
      prey: 1,
      moves: false,
      clear: { lands: ['old', 'forest'], to: 'meadow', month: 2, fields: 3, next: { x: 4, y: 4 } },
    });
    // dasselbe Feld, das die Rodung träfe
    let st = act(s, { type: 'settle', x: 3, y: 3 }).state;
    st.month = 12 + p.clear!.month;
    st = advance(st).state;
    expect(at(st, 4, 4).land).toBe('meadow');
    expect(campPreview(data, s, { x: 3, y: 2 })).toMatchObject({ valid: true, moves: true });
    // ohne Gehölz: kein Rodungsfeld; außer Zugweite bzw. ungültig: valid false
    const far = campPreview(data, s, { x: 0, y: 0 })!;
    expect(far).toMatchObject({ valid: false, clear: { fields: 0, next: null } });
    expect(far.near.map((g) => g.count)).toEqual([0, 0, 0]);
    expect(campPreview(data, s, { x: 9, y: 0 })).toBeNull();
    s.herd.stage = 'hunter';
    expect(campPreview(data, s, { x: 3, y: 3 })).toBeNull();
  });

  it('settle: nur gültig, nur mit Lager-Stufe, nicht in der Eiszeit, nur einmal', () => {
    const s = campSiteState();
    expect(() => act(s, { type: 'settle', x: 0, y: 0 })).toThrow(/kein gültiger Lagerplatz/);
    const hunter = campSiteState();
    hunter.herd.stage = 'hunter';
    expect(() => act(hunter, { type: 'settle', x: 3, y: 3 })).toThrow(/kein Lager/);
    const ice = campSiteState();
    ice.ice = 2;
    expect(view(data, ice).campSites).toEqual([]);
    expect(() => act(ice, { type: 'settle', x: 3, y: 3 })).toThrow(/Eiszeit/);
    const r = act(s, { type: 'settle', x: 3, y: 2 });
    expect(r.events).toEqual([{ type: 'campFounded', x: 3, y: 2 }]);
    expect(r.state.camp).toEqual({ x: 3, y: 2 });
    expect(r.state.herd).toMatchObject({ x: 3, y: 2, trail: [{ x: 3, y: 3 }] });
    ok(r.state);
    expect(() => act(r.state, { type: 'settle', x: 3, y: 3 })).toThrow(RuleError);
    expect(legalActions(data, r.state).some((a) => a.type === 'settle')).toBe(false);
    const v = view(data, r.state);
    expect(v.camp).toEqual({ x: 3, y: 2 });
    expect(v.cells.find((c) => c.camp)).toMatchObject({ x: 3, y: 2 });
  });

  it('sesshaft: die Herde zieht nicht mehr und isst aus dem Umkreis des Lagers', () => {
    let s = act(campSiteState(), { type: 'settle', x: 3, y: 3 }).state;
    addPrey(s, 5, 5, 1);
    expect(view(data, s).intent).toMatchObject({ x: 3, y: 3, stays: true, reason: 'settled' });
    for (let i = 0; i < 3; i++) {
      const r = advance(s);
      expect(ofType(r.events, 'herdMoved')[0]).toMatchObject({ from: { x: 3, y: 3 }, to: { x: 3, y: 3 } });
      s = r.state;
    }
    expect(s.herd).toMatchObject({ x: 3, y: 3 });
    expect(s.prey).toEqual([]); // gejagt (Umkreis 2)
  });

  it('Rodung: einmal im Jahr wird Gehölz am Lager zu Wiese, Altwald vor Wald', () => {
    const s = campSiteState();
    put(s, 4, 4, 'old');
    let st = act(s, { type: 'settle', x: 3, y: 3 }).state;
    const month = data.stages.get('human')!.camp!.clear!.month;
    st.month = 12 + month - 1;
    let r = advance(st);
    expect(ofType(r.events, 'fieldCleared')).toEqual([]);
    r = advance(r.state);
    expect(ofType(r.events, 'fieldCleared')).toEqual([{ type: 'fieldCleared', x: 4, y: 4, from: 'old', to: 'meadow' }]);
    expect(ofType(r.events, 'cellChanged')).toContainEqual({
      type: 'cellChanged',
      x: 4,
      y: 4,
      from: 'old',
      to: 'meadow',
      cause: 'clearing',
    });
    expect(at(r.state, 4, 4).land).toBe('meadow');
    st = r.state;
    st.month += 11;
    r = advance(st);
    expect(ofType(r.events, 'fieldCleared')).toEqual([
      { type: 'fieldCleared', x: 3, y: 2, from: 'forest', to: 'meadow' },
    ]);
  });
});

describe('Eiszeiten, Sieg und Niederlage', () => {
  it('Mensch mit Lager übersteht die Eiszeit: gewonnen', () => {
    const s = act(campSiteState(), { type: 'settle', x: 3, y: 3 }).state;
    s.ice = 1;
    const r = advance(s);
    expect(r.state.over).toBe('won');
    expect(ofType(r.events, 'iceAgeEnded')).toEqual([{ type: 'iceAgeEnded', survivors: 10, count: 1 }]);
    expect(ofType(r.events, 'gameWon')).toEqual([{ type: 'gameWon', survivors: 10 }]);
    expect(view(data, r.state)).toMatchObject({ over: 'won', overCause: null, intent: null, campSites: [] });
    expect(view(data, s).overCause).toBeNull();
    expect(legalActions(data, r.state)).toEqual([]);
    expect(() => advance(r.state)).toThrow(/vorbei/);
  });

  it('Mensch ohne Lager: die Partie geht weiter, die Wildnis fällt zurück; mehrere Eiszeiten', () => {
    let s = campSiteState();
    s.ice = 1;
    s.wild = 103;
    let r = advance(s);
    expect(r.state).toMatchObject({ over: null, iceAges: 1, wild: data.params.ice.wildAfter, ice: 0 });
    s = r.state;
    s.wild = 99.5;
    r = advance(s);
    expect(ofType(r.events, 'iceAgeBegan')).toHaveLength(1);
    s = r.state;
    s.herd.fat = 20;
    for (let i = 0; i < data.params.ice.months; i++) {
      s.herd.fat = 20;
      r = advance(s);
      s = r.state;
    }
    expect(ofType(r.events, 'iceAgeEnded')).toEqual([{ type: 'iceAgeEnded', survivors: s.herd.size, count: 2 }]);
    expect(s.over).toBeNull();
  });

  it('die letzte Eiszeit (ice.ages) nicht als Mensch mit Lager überstanden: verloren', () => {
    const s = inStage('hunter', season(blank(), 2));
    s.iceAges = data.params.ice.ages! - 1;
    s.ice = 1;
    const r = advance(s);
    expect(r.state.over).toBe('lost');
    expect(ofType(r.events, 'gameLost')).toEqual([{ type: 'gameLost', month: s.month, cause: 'lastIce' }]);
    expect(view(data, r.state)).toMatchObject({ over: 'lost', overCause: 'lastIce' });
    ok(r.state);
    // Ohne ice.ages geht es unbegrenzt weiter.
    const d = tweak((x) => delete x.params.ice.ages);
    expect(run(d, s).state).toMatchObject({ over: null, iceAges: data.params.ice.ages });
    expect(view(d, s).iceAges).toEqual({ survived: data.params.ice.ages! - 1, max: null });
  });

  it('stirbt die Herde in der Eiszeit aus, ist die Partie verloren (auch mit Lager)', () => {
    const s = act(campSiteState(), { type: 'settle', x: 3, y: 3 }).state;
    s.ice = 1;
    s.herd.size = 1;
    s.herd.fat = 0;
    for (const c of s.cells) c.food = 0;
    put(s, 3, 2, 'steppe', { food: 0 });
    const r = advance(s);
    expect(r.state.over).toBe('lost');
    expect(ofType(r.events, 'gameLost')).toEqual([{ type: 'gameLost', month: s.month, cause: 'extinct' }]);
    expect(view(data, r.state)).toMatchObject({ over: 'lost', overCause: 'extinct' });
    ok(r.state);
  });
});

describe('validateState: Wild, Lager, Eiszeiten', () => {
  it('Version 3 (vor H3b) wird abgelehnt', () => {
    const { prey: _p, nextPreyId: _n, camp: _c, iceAges: _i, ...old } = blank();
    expect(validateState(data, { ...old, version: 3 })).toEqual({ ok: false, reason: 'Version 3 statt 4' });
  });

  it.each<[string, (s: HerdeState) => void, RegExp]>([
    ['Wild-Größe 0', (s) => addPrey(s, 1, 1, 0), /Format: prey.0.size/],
    ['Wild außerhalb', (s) => addPrey(s, 9, 1), /Wild 1 außerhalb/],
    ['Wild auf Fels', (s) => (put(s, 1, 1, 'rock'), addPrey(s, 1, 1)), /Wild 1 auf unbegehbarem/],
    ['zwei Bestände', (s) => (addPrey(s, 1, 1), addPrey(s, 1, 1)), /zwei Wildbestände/],
    ['Wild zu groß', (s) => addPrey(s, 1, 1, 9), /Wild 1 größer/],
    ['Wild-Id doppelt', (s) => (addPrey(s, 1, 1), s.prey.push({ ...s.prey[0]!, x: 2 })), /Wild-Id 1 doppelt/],
    ['Wild-Id zu groß', (s) => (addPrey(s, 1, 1), (s.nextPreyId = 1)), /Wild-Id 1 ≥ nextPreyId/],
    ['Lager ohne Lager-Stufe', (s) => (s.camp = { x: 3, y: 3 }), /Lager auf Stufe herd/],
    ['Lager außerhalb', (s) => ((s.herd.stage = 'human'), (s.camp = { x: 9, y: 3 })), /Lager außerhalb/],
    ['Herde nicht am Lager', (s) => ((s.herd.stage = 'human'), (s.camp = { x: 2, y: 3 })), /Herde nicht am Lager/],
    ['zu viele Eiszeiten', (s) => (s.iceAges = 9), /9 Eiszeiten/],
    ['ausgestorben, Partie läuft', (s) => ((s.herd.size = 0), (s.herd.fat = 0)), /ausgestorben, Partie läuft/],
    ['letzte Eiszeit, Partie läuft', (s) => (s.iceAges = data.params.ice.ages!), /letzte Eiszeit überstanden/],
    ['gewonnen ohne Herde', (s) => ((s.over = 'won'), (s.herd.size = 0), (s.herd.fat = 0)), /gewonnen ohne Herde/],
    ['verloren mit lebender Herde', (s) => (s.over = 'lost'), /verloren mit lebender Herde/],
  ])('erkennt: %s', (_, fn, reason) => {
    const s = blank();
    fn(s);
    expect(validateState(data, s)).toMatchObject({ ok: false, reason: expect.stringMatching(reason) });
  });
});

describe('Zufalls-Bot bis zum Sieg', () => {
  it('erreicht alle Stufen, gründet ein Lager und gewinnt (Seed 1)', () => {
    const r = playRandomGame(data, { seed: 1, check: true });
    expect(r.stages).toEqual(['herd', 'gatherer', 'wanderer', 'hunter', 'human']);
    expect(r.camp).toBe(true);
    expect(r.outcome).toBe('won');
  });
});
