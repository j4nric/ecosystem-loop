/** Konzept 6.1 und 7: Harmonie-Beiträge, Kollaps, Odem-Zufluss und Obergrenze. */
import { describe, expect, it } from 'vitest';
import { breathIncome } from '../src/rules/breath.ts';
import { harmonyParts } from '../src/rules/harmony.ts';
import { data, game, runRules, setStats } from './helpers.ts';

describe('Harmonie (Konzept 7)', () => {
  it('startet bei 60 und bleibt bei normalen Formen gleich', () => {
    const s = game({ life: false });
    expect(s.harmony).toBe(60);
    runRules(s, ['harmony']);
    expect(s.harmony).toBe(60);
    expect(s.harmonyTrend).toBe(0);
  });

  it('Idealform +2, verödete Form −3 je Zone', () => {
    const s = game({ life: false });
    setStats(s, 'forest', { vegetation: 5, moisture: 4, deadwood: 2 }); // Urwald
    setStats(s, 'plains', { moisture: 3, soil: 4, vegetation: 3 }); // Blumenwiese
    setStats(s, 'river', { water: 0 }); // trockenes Flussbett
    runRules(s, ['forms', 'harmony']);
    expect(s.harmony).toBe(60 + 2 + 2 - 3);
    expect(s.harmonyTrend).toBe(1);
  });

  it('Störung in dieser Runde kostet Harmonie (Platzhalter aus harmony.yaml)', () => {
    const s = game({ life: false });
    s.round = 3;
    s.zones[0]!.lastDisturbance = 3;
    s.zones[1]!.lastDisturbance = 2;
    expect(harmonyParts(data, s)).toEqual([{ source: 'disturbance', zone: 'mountains', amount: -2 }]);
  });

  it('Arten zählen +0,5 je lebender Art (vorbereitet für Phase 2)', () => {
    const s = game({ life: false });
    s.zones[0]!.populations = { beetle: 2, bee: 0 };
    s.zones[1]!.populations = { beetle: 1, plankton: 3 };
    expect(harmonyParts(data, s)).toContainEqual({ source: 'species', zone: null, amount: 1 });
  });

  it('bleibt in 0–100; bei 0 kollabiert die Welt', () => {
    const s = game({ life: false });
    s.harmony = 99;
    setStats(s, 'forest', { vegetation: 5, moisture: 4, deadwood: 2 });
    runRules(s, ['forms', 'harmony']);
    expect(s.harmony).toBe(100);
    expect(s.phase).toBe('play');

    const t = game({ life: false });
    t.harmony = 3;
    setStats(t, 'river', { water: 0 });
    const events = runRules(t, ['forms', 'harmony']);
    expect(t.harmony).toBe(0);
    expect(t.phase).toBe('over');
    expect(events).toContainEqual({ type: 'collapsed', round: 1 });
  });

  it('knapp über 0 kein Kollaps', () => {
    const t = game({ life: false });
    t.harmony = 4;
    setStats(t, 'river', { water: 0 });
    runRules(t, ['forms', 'harmony']);
    expect(t.harmony).toBe(1);
    expect(t.phase).toBe('play');
  });
});

describe('Odem (Konzept 6.1)', () => {
  it('Zufluss = 1 + ⌊Harmonie / 25⌋', () => {
    const s = game({ life: false });
    for (const [h, income] of [
      [0, 1],
      [24, 1],
      [25, 2],
      [60, 3],
      [74.5, 3],
      [75, 4],
      [100, 5],
    ] as const) {
      s.harmony = h;
      expect(breathIncome(data, s), `Harmonie ${h}`).toBe(income);
    }
  });

  it('+1, wenn mindestens 6 Arten leben', () => {
    const s = game({ life: false });
    s.zones[0]!.populations = { a: 1, b: 1, c: 1, d: 1, e: 1 };
    expect(breathIncome(data, s)).toBe(3);
    s.zones[1]!.populations = { f: 1 };
    expect(breathIncome(data, s)).toBe(4);
  });

  it('fließt in der Bilanz zu und ist bei 10 gedeckelt', () => {
    const s = game({ life: false });
    s.breath = 2;
    const events = runRules(s, ['breath']);
    expect(s.breath).toBe(5);
    expect(events).toContainEqual({ type: 'breathChanged', from: 2, to: 5, cause: 'income' });
    s.breath = 9;
    runRules(s, ['breath']);
    expect(s.breath).toBe(10);
    expect(runRules(s, ['breath'])).toEqual([]);
  });
});
