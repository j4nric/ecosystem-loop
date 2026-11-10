/**
 * Gleichheit mit dem Prototyp (prototypes/herde/index.html): Für feste Seeds und eine feste Zugfolge liefern
 * Engine und Prototyp-Logik nach jedem Schritt denselben Zustand (Herde, Felder, Rudel, Hand, Wildnis, Zufall).
 *
 * Ab Konzept 1.5 (H3b) ist die Eiszeit eine Prüfung unterwegs: Wo der Prototyp nach der ersten Eiszeit gewinnt, geht
 * die Partie in der Engine weiter (Wildnis fällt zurück, eine neue Jahreszeit beginnt). Bis einschließlich dieses
 * Monats ist der Verlauf gleich; im letzten Schritt unterscheiden sich nur Ende, Wildnis, Hand und Zufall (neue
 * Jahreszeit: Karten ziehen). Wild gibt es in der Startphase nicht (prey.from), es ändert den Verlauf also nicht.
 */
import { describe, expect, it } from 'vitest';
import { legalPlays, newGame, step, view, type Action, type HerdeState } from '../src/index.ts';
import { data, loadPrototype, type ProtoState } from './helpers.ts';

const P = loadPrototype();

function snapshot(s: HerdeState) {
  return {
    rng: s.rng,
    month: s.month,
    ice: s.ice,
    wild: s.wild,
    over: s.over,
    hand: [...s.hand],
    herd: { x: s.herd.x, y: s.herd.y, n: s.herd.size, fat: s.herd.fat, thirst: s.herd.thirst, trail: s.herd.trail },
    packs: s.packs.map((p) => ({ x: p.x, y: p.y, size: p.size, fed: p.fed, hungry: p.hungry })),
    cells: s.cells.map((c) => ({ t: c.land, food: c.food, fert: c.fertile })),
  };
}

function protoSnapshot(s: ProtoState) {
  return {
    rng: s.rs,
    month: s.month,
    ice: s.ice,
    wild: s.wild,
    over: s.over,
    hand: [...s.hand],
    herd: { x: s.herd.x, y: s.herd.y, n: s.herd.n, fat: s.herd.fat, thirst: s.herd.thirst, trail: s.herd.trail },
    packs: s.packs.map((p) => ({ x: p.x, y: p.y, size: p.size, fed: p.fed, hungry: p.hungry })),
    cells: s.cells.map((c) => ({ t: c.t, food: c.food, fert: c.fert })),
  };
}

/** Feste Zugfolge: zu Beginn jeder Jahreszeit bis zu zwei Karten, Ziel aus der Liste gültiger Züge per Monat. */
function chooseActions(s: HerdeState, policy: 'none' | 'cards'): Action[] {
  if (policy === 'none' || s.month % 3 !== 0) return [];
  const picks: Action[] = [];
  let sim = s;
  for (let k = 0; k < 2; k++) {
    const moves = legalPlays(data, sim);
    if (moves.length === 0) break;
    const a = moves[(sim.month * 7 + k * 13) % moves.length]!;
    picks.push(a);
    sim = step(data, sim, a).state;
  }
  return picks;
}

function runBoth(seed: number, policy: 'none' | 'cards') {
  let s = newGame(data, { seed });
  const p = P.newGame(seed);
  expect(snapshot(s)).toEqual(protoSnapshot(p));
  let checked = 0;
  while (!s.over && s.month < 240) {
    for (const a of chooseActions(s, policy)) {
      if (a.type !== 'play') continue;
      s = step(data, s, a).state;
      expect(P.playCard(p, a.hand, a.x ?? 0, a.y ?? 0)).toBe(true);
      expect(snapshot(s)).toEqual(protoSnapshot(p));
    }
    // Die angezeigte Absicht ist das Feld, auf das der Monat die Herde führt (in Engine und Prototyp).
    const intent = view(data, s).intent!;
    const r = step(data, s, { type: 'advance' });
    s = r.state;
    P.nextMonth(p);
    expect({ x: s.herd.x, y: s.herd.y }).toEqual({ x: intent.x, y: intent.y });
    checked++;
    if (p.over === 'won') {
      // Erste Eiszeit überstanden: Der Prototyp endet mit Sieg, die Engine geht weiter.
      const { over, wild, hand, rng, ...rest } = snapshot(s);
      const { over: pOver, wild: pWild, hand: pHand, rng: pRng, ...pRest } = protoSnapshot(p);
      expect(rest).toEqual(pRest);
      expect([over, pOver, wild]).toEqual([null, 'won', data.params.ice.wildAfter]);
      // Hand und Zufall: gleich, außer die Engine zieht zur neuen Jahreszeit Karten (dann kommen sie hinten dazu).
      expect(hand.slice(0, pHand.length)).toEqual(pHand);
      expect(rng === pRng).toBe(hand.length === pHand.length);
      expect(r.events.filter((e) => e.type === 'iceAgeEnded')).toEqual([
        { type: 'iceAgeEnded', survivors: s.herd.size, count: 1 },
      ]);
      expect(pWild).toBeGreaterThan(wild);
      return { s, checked, proto: p };
    }
    expect(snapshot(s)).toEqual(protoSnapshot(p));
  }
  return { s, checked, proto: p };
}

describe('Gleichheit mit dem Prototyp', () => {
  it.each([1, 7919, 15838])('ohne Karten, Seed %i: gleicher Verlauf bis zum Ende', (seed) => {
    const { checked, proto } = runBoth(seed, 'none');
    expect(checked).toBeGreaterThan(12);
    expect(proto.over).not.toBeNull();
  });

  it.each([3, 42, 2024])('mit fester Kartenfolge, Seed %i: gleicher Verlauf bis zum Ende', (seed) => {
    const { proto } = runBoth(seed, 'cards');
    expect(proto.over).not.toBeNull();
  });
});
