import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildGameData, legalPlays, newGame, type RawData } from '@being-god/core';
import { loadGameData, readRawData } from '@being-god/core/node';
import { createBot, scorePlay } from '../src/bots.ts';
import { runGame, simulate } from '../src/sim.ts';

const data = loadGameData();

describe('Absturz-Test', () => {
  it('beide Bots spielen ohne Fehler, deterministisch je Seed', () => {
    for (const bot of ['random', 'greedy'] as const) {
      const opts = { bot, runs: 4, seed: 's', scenario: 'random', maxRounds: 40 };
      const a = simulate(data, opts);
      expect(a.errors).toEqual([]);
      expect(a.runs).toBe(4);
      expect(a.avgRounds).toBeGreaterThan(0);
      expect(simulate(data, opts)).toEqual(a);
    }
  });

  it('Kollaps beendet die Partie (Welt mit schwindender Harmonie)', () => {
    const raw = readRawData() as RawData & { harmony: { start: number; perRound: { formKind: { normal: number } } } };
    raw.harmony.start = 3;
    raw.harmony.perRound.formKind.normal = -1;
    const fragile = buildGameData(raw);
    const s = simulate(fragile, { bot: 'random', runs: 3, seed: 'k', scenario: 'standard', maxRounds: 50 });
    expect(s).toMatchObject({ collapsed: 3, errors: [] });
    expect(s.avgRounds).toBeLessThanOrEqual(3);
  });

  it('Rundenlimit beendet die Partie ohne Kollaps', () => {
    const r = runGame(data, { bot: 'greedy', seed: 'x', scenario: 'standard', maxRounds: 3 });
    expect(r).toEqual({ scenario: 'standard', rounds: 3, collapsed: false, error: null });
  });

  it('Fehler werden gemeldet statt geworfen', () => {
    const r = runGame(data, { bot: 'random', seed: 'x', scenario: 'nope', maxRounds: 3 });
    expect(r.error).toMatch(/Unbekanntes Szenario/);
    const s = simulate(data, { bot: 'random', runs: 2, seed: 'x', scenario: 'nope', maxRounds: 3 });
    expect(s.errors).toHaveLength(2);
    expect(s.avgRounds).toBe(0);
  });

  it('greedy bevorzugt Züge Richtung Idealform', () => {
    const s = newGame(data, { seed: 1 });
    s.hand = [1, 2, 3, 4].map((uid) => ({ uid: 900 + uid, card: uid <= 2 ? 'seeds' : 'rain' }));
    s.forecast = null;
    s.zones.find((z) => z.id === 'forest')!.stats = { light: 2, moisture: 4, vegetation: 4, deadwood: 2 };
    const plays = legalPlays(data, s).filter((p) => p.card === 'seeds');
    const best = plays.reduce((a, b) => (scorePlay(data, s, b) > scorePlay(data, s, a) ? b : a));
    expect(best.targets.zone).toBe('forest');
    const action = createBot('greedy').choose(data, s);
    expect(action).toMatchObject({ type: 'play', targets: { zone: 'forest' } });
  });
});

describe('Konsole', () => {
  it('eine Partie lässt sich per Eingabe spielen', () => {
    const script = fileURLToPath(new URL('../src/cli/play.ts', import.meta.url));
    const r = spawnSync(process.execPath, ['--import', 'tsx', script, '--seed', '3'], {
      input: 'z\n1\n1\nz\n9\nq\n',
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Runde 1');
    expect(r.stdout).toContain('Kartenzwang');
    expect(r.stdout).toContain('Runde 2');
    expect(r.stdout).toContain('Keine solche Karte');
    expect(r.stdout).toContain('Aufgehört.');
    // Zielbereiche der Idealform: z. B. Wasserstand der Aue genau 3, dazu Abstand bzw. ✓.
    expect(r.stdout).toMatch(/W \d \[=3 [↑✓↓]\]/);
    expect(r.stdout).toMatch(/→ Aue( ✓| \(Abstand \d+\))/);
  });
});
