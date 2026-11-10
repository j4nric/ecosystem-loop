/** Konzept 4.1, 4.3, 4.4 und 9: Jahreszeiten, Selbstheilung, Kopplungen, Zonenstufe. */
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/state.ts';
import { data, dataWith, game, rest, runRules, setStats, zone } from './helpers.ts';

/** Zustand in einer bestimmten Jahreszeit (Runde 1 = Frühling). */
function inSeason(season: 'spring' | 'summer' | 'autumn' | 'winter'): GameState {
  const s = game({ hand: [], draw: [] });
  s.round = { spring: 1, summer: 2, autumn: 3, winter: 4 }[season];
  return s;
}

describe('Jahreszeiten (Konzept 9)', () => {
  it('Frühling: Vegetation +1 in Zonen mit Feuchte ≥ 2', () => {
    const s = inSeason('spring');
    setStats(s, 'plains', { moisture: 2, vegetation: 3 });
    setStats(s, 'coast', { moisture: 1, vegetation: 1 });
    runRules(s, ['season']);
    expect(zone(s, 'plains').stats.vegetation).toBe(4);
    expect(zone(s, 'coast').stats.vegetation).toBe(1);
  });

  it('Sommer: Feuchte −1 überall', () => {
    const s = inSeason('summer');
    runRules(s, ['season']);
    for (const z of s.zones) expect(z.stats.moisture).toBe(rest(z.geography).moisture! - 1);
  });

  it('Herbst: Totholz +1 und Vegetation −1 im Wald, sonst nichts', () => {
    const s = inSeason('autumn');
    const events = runRules(s, ['season']);
    expect(zone(s, 'forest').stats).toMatchObject({ deadwood: 3, vegetation: 3 });
    expect(events.filter((e) => e.type === 'statChanged').every((e) => 'zone' in e && e.zone === 'forest')).toBe(true);
  });

  it('Winter: Schnee +1 (nur wo es Schnee gibt), Wachstum pausiert', () => {
    const s = inSeason('winter');
    runRules(s, ['season']);
    expect(zone(s, 'mountains').stats.snow).toBe(4);
    expect(zone(s, 'forest').stats).toEqual(rest('forest'));
    expect(data.seasons.find((x) => x.id === 'winter')!.pausesGrowth).toBe(true);
  });

  it('Werte bleiben in der Skala 0–5', () => {
    const s = inSeason('winter');
    setStats(s, 'mountains', { snow: 5 });
    const events = runRules(s, ['season']);
    expect(zone(s, 'mountains').stats.snow).toBe(5);
    expect(events.some((e) => e.type === 'statChanged')).toBe(false);
  });
});

describe('Selbstheilung (Konzept 4.1)', () => {
  it('alle 2 Runden bewegt sich jeder Wert um 1 zum Ruhewert', () => {
    const s = game();
    setStats(s, 'forest', { light: 5, moisture: 0, vegetation: 4 });
    s.round = 1;
    expect(runRules(s, ['healing'])).toEqual([]);
    s.round = 2;
    runRules(s, ['healing']);
    expect(zone(s, 'forest').stats).toMatchObject({ light: 4, moisture: 1, vegetation: 4 });
    s.round = 4;
    runRules(s, ['healing']);
    expect(zone(s, 'forest').stats).toMatchObject({ light: 3, moisture: 2 });
  });
});

describe('Kopplungen (Konzept 4.3)', () => {
  it('Schneeschmelze: im Frühling wandert Schnee der Berge als Wasserstand in den Fluss', () => {
    const s = inSeason('spring');
    setStats(s, 'mountains', { snow: 3 });
    setStats(s, 'river', { water: 2 });
    const events = runRules(s, ['couplings']);
    expect(zone(s, 'mountains').stats.snow).toBe(2);
    expect(zone(s, 'river').stats.water).toBe(3);
    expect(events).toContainEqual({ type: 'couplingApplied', coupling: 'snowmelt', from: 'mountains', to: 'river' });
  });

  it('Schneeschmelze nur im Frühling und nur, wenn Schnee liegt', () => {
    const s = inSeason('summer');
    runRules(s, ['couplings']);
    expect(zone(s, 'mountains').stats.snow).toBe(3);
    const t = inSeason('spring');
    setStats(t, 'mountains', { snow: 0 });
    setStats(t, 'river', { water: 2 });
    runRules(t, ['couplings']);
    expect(zone(t, 'river').stats.water).toBe(2);
  });

  it('Schneeschmelze in einen vollen Fluss: Schnee schmilzt, Wasserstand bleibt am Maximum', () => {
    const s = inSeason('spring');
    setStats(s, 'river', { water: 5 });
    runRules(s, ['couplings']);
    expect(zone(s, 'mountains').stats.snow).toBe(2);
    expect(zone(s, 'river').stats.water).toBe(5);
  });

  it('Süßwasser: Fluss mit Wasserstand ≥ 3 senkt das Salz der Küste', () => {
    const s = inSeason('summer');
    setStats(s, 'river', { water: 3 });
    runRules(s, ['couplings']);
    expect(zone(s, 'coast').stats.salt).toBe(2);
    const t = inSeason('summer');
    setStats(t, 'river', { water: 2 });
    runRules(t, ['couplings']);
    expect(zone(t, 'coast').stats.salt).toBe(3);
  });

  it('Waldklima: Wald mit Vegetation ≥ 4 erhöht die Feuchte des Flachlands', () => {
    const s = inSeason('summer');
    setStats(s, 'forest', { vegetation: 4 });
    runRules(s, ['couplings']);
    expect(zone(s, 'plains').stats.moisture).toBe(4);
    const t = inSeason('summer');
    setStats(t, 'forest', { vegetation: 3 });
    runRules(t, ['couplings']);
    expect(zone(t, 'plains').stats.moisture).toBe(3);
  });

  it('Hochwasser (Wasserstand 5) überflutet alle Nachbarn des Flusses: Feuchte +1, Vegetation −1', () => {
    const s = inSeason('summer');
    setStats(s, 'river', { water: 5 });
    setStats(s, 'forest', { vegetation: 3 }); // kein Waldklima
    runRules(s, ['couplings']);
    for (const id of ['mountains', 'forest', 'plains', 'coast']) {
      const z = zone(s, id);
      const r = rest(z.geography);
      expect(z.stats.moisture, id).toBe(Math.min(5, r.moisture! + 1));
      expect(z.stats.vegetation, id).toBe((id === 'forest' ? 3 : r.vegetation!) - 1);
    }
    expect(zone(s, 'river').stats.vegetation).toBe(rest('river').vegetation);
  });
});

describe('Zonenstufe (Konzept 4.4)', () => {
  /** Natur-Schritte Formen + Stufen für n Runden ab Runde `from`. */
  function rounds(s: GameState, n: number, from = 1, d = data) {
    const events = [];
    for (let i = 0; i < n; i++) {
      s.round = from + i;
      events.push(...runRules(s, ['forms', 'levels'], d));
    }
    return events;
  }

  it('steigt nach 3 Runden am Stück in derselben nicht verödeten Form', () => {
    const s = game();
    rounds(s, 2);
    expect(zone(s, 'forest').level).toBe(1);
    expect(zone(s, 'forest').levelProgress).toBe(2);
    rounds(s, 1, 3);
    expect(zone(s, 'forest').level).toBe(2);
    expect(zone(s, 'forest').levelProgress).toBe(0);
    rounds(s, 6, 4);
    expect(zone(s, 'forest').level).toBe(4 - 1); // normale Form: höchstens Stufe 3
  });

  it('Stufe 4 und 5 nur in der Idealform', () => {
    const s = game();
    zone(s, 'forest').level = 3;
    rounds(s, 6);
    expect(zone(s, 'forest').level).toBe(3);
    setStats(s, 'forest', { vegetation: 5, moisture: 4, deadwood: 2 }); // Urwald
    rounds(s, 1, 7); // Formwechsel: −1
    expect(zone(s, 'forest').level).toBe(2);
    rounds(s, 9, 8);
    expect(zone(s, 'forest').level).toBe(5);
    rounds(s, 3, 17);
    expect(zone(s, 'forest').level).toBe(5);
  });

  it('fällt um 1 bei verödeter Form (jede Runde), nie unter 1', () => {
    const s = game();
    zone(s, 'plains').level = 2;
    setStats(s, 'plains', { vegetation: 0, moisture: 0 }); // Ödland
    const events = rounds(s, 3);
    expect(zone(s, 'plains').level).toBe(1);
    expect(events).toContainEqual({ type: 'levelChanged', zone: 'plains', from: 2, to: 1, reason: 'degraded' });
    expect(events.filter((e) => e.type === 'levelChanged' && e.zone === 'plains')).toHaveLength(1);
  });

  it('fällt nach einer Störung, auch ohne Formwechsel', () => {
    const s = game();
    zone(s, 'coast').level = 3;
    zone(s, 'coast').levelProgress = 2;
    s.round = 5;
    zone(s, 'coast').lastDisturbance = 5;
    const events = runRules(s, ['levels']);
    expect(zone(s, 'coast').level).toBe(2);
    expect(zone(s, 'coast').levelProgress).toBe(0);
    expect(events).toContainEqual({ type: 'levelChanged', zone: 'coast', from: 3, to: 2, reason: 'disturbance' });
  });

  it('fällt beim Wechsel in eine andere Form, höchstens um 1 pro Runde', () => {
    const s = game();
    zone(s, 'river').level = 3;
    s.round = 2;
    zone(s, 'river').lastDisturbance = 2;
    setStats(s, 'river', { water: 5 }); // Hochwasser: Formwechsel + Störung
    runRules(s, ['forms', 'levels']);
    expect(zone(s, 'river').level).toBe(2);
  });

  it('Formwechsel in eine normale Form: Grund „formChanged“', () => {
    const s = game();
    zone(s, 'plains').level = 2;
    setStats(s, 'plains', { moisture: 5 }); // Moor
    expect(runRules(s, ['forms', 'levels'])).toContainEqual({
      type: 'levelChanged',
      zone: 'plains',
      from: 2,
      to: 1,
      reason: 'formChanged',
    });
  });

  it('verödet ohne Formwechsel: Grund „degraded“', () => {
    const s = game();
    setStats(s, 'river', { water: 0 });
    runRules(s, ['forms']);
    zone(s, 'river').level = 2;
    s.round = 2;
    expect(runRules(s, ['levels'])).toContainEqual({
      type: 'levelChanged',
      zone: 'river',
      from: 2,
      to: 1,
      reason: 'degraded',
    });
  });

  it('Arten-Bedingung (abschaltbar): ohne genug Arten kein Aufstieg, Stufe 5 braucht ≥ 4 Arten', () => {
    const d = dataWith((r) => {
      r.config.rules.levels.species.enabled = true;
    });
    const s = game({ d });
    rounds(s, 6, 1, d);
    expect(zone(s, 'forest').level).toBe(1);
    zone(s, 'forest').populations = { a: 1 };
    rounds(s, 3, 7, d);
    expect(zone(s, 'forest').level).toBe(2);

    setStats(s, 'forest', { vegetation: 5, moisture: 4, deadwood: 2 });
    zone(s, 'forest').level = 4;
    zone(s, 'forest').form = 'primeval_forest';
    zone(s, 'forest').formSince = 0;
    rounds(s, 3, 20, d);
    expect(zone(s, 'forest').level).toBe(4);
    zone(s, 'forest').populations = { a: 1, b: 2, c: 3, d: 4 };
    rounds(s, 3, 30, d);
    expect(zone(s, 'forest').level).toBe(5);
  });
});
