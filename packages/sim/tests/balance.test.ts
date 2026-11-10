import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newBook, newGame, validateDeck, type GameState } from '@being-god/core';
import { loadGameData, readRawData } from '@being-god/core/node';
import { BOT_NAMES, createBot } from '../src/bots.ts';
import { deckFor, runCampaigns } from '../src/campaign.ts';
import { main as balance } from '../src/cli/balance.ts';
import { main as compare, parseVariant } from '../src/cli/compare.ts';
import { aggregate, median, percentile, recordGame } from '../src/metrics.ts';
import { campaignSimRun, comparisonSimRun, finding, table, toSimRun } from '../src/report.ts';
import { evolutionFunnel, evaluate, idealDistance, PROFILES, projectNature, yearAt } from '../src/strategy.ts';
import { applyTweak, gameDataWith, pathOf } from '../src/tweaks.ts';

const data = loadGameData();
const meta = { createdAt: '2026-11-10T12:00:00.000Z', model: 'Test' };

/** Partie ohne Ereignis-Ankündigung in Runde 1 (für konstruierte Zustände). */
function quiet(seed = 1): GameState {
  const s = newGame(data, { seed });
  s.forecast = null;
  return s;
}

describe('Strategie-Bots', () => {
  it('alle Bots spielen ohne Fehler und deterministisch je Seed', () => {
    for (const bot of BOT_NAMES) {
      const a = recordGame(data, { bot, seed: 'b', scenario: 'standard', maxRounds: 12 }).record;
      expect(a.error).toBeNull();
      expect(a.rounds).toBeGreaterThan(0);
      expect(recordGame(data, { bot, seed: 'b', scenario: 'standard', maxRounds: 12 }).record).toEqual(a);
    }
  });

  it('die Vorausschau verändert den Zustand nicht und kennt Jahreszeit und Selbstheilung', () => {
    const s = quiet();
    s.round = 2; // Sommer: Feuchte −1, gerade Runde: Selbstheilung 1 Schritt zum Ruhewert (3)
    const forest = (x: GameState) => x.zones.find((z) => z.id === 'forest')!.stats;
    forest(s).moisture = 5;
    const before = structuredClone(s);
    const p = projectNature(data, s);
    expect(s).toEqual(before);
    expect(forest(p).moisture).toBe(3);
  });

  it('die Vorausschau wendet das angekündigte Ereignis an (Hitzesommer mit Stärke)', () => {
    const s = quiet();
    s.forecast = { event: 'heatwave', round: s.round, strength: 2, zone: null };
    const p = projectNature(data, s);
    const q = projectNature(data, quiet());
    for (const [i, z] of p.zones.entries()) expect(z.stats.moisture).toBe(Math.max(0, q.zones[i]!.stats.moisture! - 2));
  });

  it('Abstand zur Idealform ist 0 in der Idealform', () => {
    const s = quiet();
    const forest = s.zones.find((z) => z.id === 'forest')!;
    forest.stats = { light: 2, moisture: 4, vegetation: 5, deadwood: 2 };
    expect(idealDistance(data, forest)).toBe(0);
    forest.stats = { light: 2, moisture: 2, vegetation: 2, deadwood: 4 };
    expect(idealDistance(data, forest)).toBe(2 + 2 + 1);
  });

  it('Gärtner wendet ein schweres angekündigtes Ereignis mit Stille ab', () => {
    const s = quiet();
    s.breath = 6;
    s.hand = [
      { uid: 901, card: 'silence' },
      { uid: 902, card: 'frost' },
    ];
    s.forecast = { event: 'heatwave', round: s.round, strength: 3, zone: null };
    const action = createBot('gardener').choose(data, s);
    expect(action).toMatchObject({ type: 'play', uid: 901 });
  });

  it('Evolutionsjäger schätzt Selektionsdruck, der Gärtner nicht', () => {
    const s = quiet();
    // Frösche bereit für die Echse: Moor im Flachland, Strand an der Küste mit Stufe 2.
    const plains = s.zones.find((z) => z.id === 'plains')!;
    const coast = s.zones.find((z) => z.id === 'coast')!;
    plains.populations = { frog: 6, beetle: 6 };
    coast.form = 'beach';
    coast.level = 2;
    const calm = evaluate(data, s, PROFILES.evolver);
    const shaken = structuredClone(s);
    shaken.zones.find((z) => z.id === 'river')!.lastDisturbance = s.round;
    const gain = (p: (typeof PROFILES)[keyof typeof PROFILES]) => evaluate(data, shaken, p) - evaluate(data, s, p);
    expect(evaluate(data, shaken, PROFILES.evolver)).toBeGreaterThan(calm);
    expect(gain(PROFILES.evolver)).toBeGreaterThan(gain(PROFILES.gardener));
    expect(evolutionFunnel(data, shaken).lizard).toBe(5);
    expect(evolutionFunnel(data, s).lizard).toBe(4);
  });
});

describe('Kennzahlen', () => {
  it('Perzentile und Median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(percentile([0, 10], 0.1)).toBe(1);
    expect(percentile([], 0.5)).toBeNull();
    expect(yearAt(data, 1)).toBe(1);
    expect(yearAt(data, 5)).toBe(2);
  });

  it('Protokoll und Auswertung einer kleinen Messreihe', () => {
    const recs = [0, 1, 2, 3].map(
      (i) => recordGame(data, { bot: 'greedy', seed: `m${i}`, scenario: 'standard', maxRounds: 16 }).record,
    );
    for (const r of recs) {
      expect(r.harmony.length).toBe(r.rounds);
      expect(Object.values(r.formKinds).reduce((a, b) => a + b, 0)).toBe(r.rounds * data.zones.length);
      expect(r.tierRound[1]).toBe(0);
    }
    const rep = aggregate(data, 'greedy', 'standard', recs);
    expect(rep.runs).toBe(4);
    expect(rep.errors).toEqual([]);
    expect(rep.rounds.median).toBe(16);
    expect(rep.tiers[1]!.share).toBe(1);
    expect(rep.byYear.years).toEqual([1, 2, 3, 4]);
    expect(rep.byYear.alive.every((v) => v === 1)).toBe(true);
    expect(Object.values(rep.formKinds).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(rep.funnel.fish).toBeDefined();

    const run = toSimRun(rep, meta, 'Test');
    expect(run.charts.every((c) => c.series.length <= 4)).toBe(true);
    expect(run.metrics.every((m) => typeof m.unit === 'string')).toBe(true);
    expect(run.notes).toBe(finding(rep));
    expect(run.notes).toMatch(/zu kurz/);
    const cmp = comparisonSimRun([rep, rep, rep, rep, rep], meta, 'Vergleich');
    expect(cmp.charts.every((c) => c.series.length <= 4)).toBe(true);
    expect(table([rep])).toContain('greedy');
  });

  it('Fehler werden im Datensatz gemeldet', () => {
    const r = recordGame(data, { bot: 'random', seed: 'x', scenario: 'nope', maxRounds: 3 }).record;
    expect(r.error).toMatch(/Unbekanntes Szenario/);
    expect(aggregate(data, 'random', 'nope', [r]).errors).toHaveLength(1);
  });
});

describe('Kampagnen und Daten-Varianten', () => {
  it('Startdecks der Bots sind gültig für ihr Buch', () => {
    for (const bot of BOT_NAMES) expect(validateDeck(data, newBook(), deckFor(data, bot, newBook(), 's'))).toEqual([]);
  });

  it('eine kleine Kampagne trägt Partien ins Buch ein und misst gegen die Kontrolle', () => {
    const c = runCampaigns(data, {
      bot: 'gardener',
      campaigns: 2,
      games: 2,
      seed: 'k',
      scenarios: ['standard'],
      maxRounds: 8,
    });
    expect(c.games).toHaveLength(2);
    expect(c.games[0]).toHaveLength(2);
    expect(c.control[1]).toHaveLength(2);
    expect(c.games.flat().every((r) => r.error === null)).toBe(true);
    // Partie 1 der Kampagne ist die Kontrolle selbst (leeres Buch).
    expect(c.games[0]).toEqual(c.control[0]);
    // Nach 8 Runden ist der Meilenstein „Das erste Jahr“ erreicht.
    expect(c.milestones.first_year![0]).toBe(1);
    expect(c.poolSize[1]).toBeGreaterThan(c.poolSize[0]!);
    const run = campaignSimRun('gardener', c, meta, 'Kampagne', 'standard');
    expect(run.charts.every((ch) => ch.series.length <= 4)).toBe(true);
  });

  it('Änderungen an den Rohdaten im Speicher', () => {
    expect(pathOf('geographies.geographies[mountains].rest.snow')).toEqual([
      'geographies',
      'geographies',
      'mountains',
      'rest',
      'snow',
    ]);
    const raw = readRawData();
    applyTweak(raw, 'geographies.geographies[mountains].rest.snow=2');
    applyTweak(raw, 'config.starterDeck=["rain","rain","sun","sun","seeds","seeds","healing","frost"]');
    expect(() => applyTweak(raw, 'config.rules.nope.x=1')).toThrow(/Unbekannter Pfad/);
    expect(() => applyTweak(raw, 'config.turn.nope=1')).toThrow(/Unbekannter Schlüssel/);
    applyTweak(raw, '+events.events[plague].scales=false');
    expect(() => applyTweak(raw, 'events.events[nope].scales=false')).toThrow(/Unbekannter Pfad/);
    expect(() => applyTweak(raw, 'config.turn.handSize')).toThrow(/ohne "="/);
    const d = gameDataWith(['config.rules.life.food.perPrey=3']);
    expect((d.params.life as { food: { perPrey: number } }).food.perPrey).toBe(3);
    expect((data.params.life as { food: { perPrey: number } }).food.perPrey).toBe(2);
  });

  it('die Messung schreibt Cockpit-Dateien', () => {
    const out = mkdtempSync(join(tmpdir(), 'balance-'));
    const code = balance([
      '--bots',
      'random,gardener',
      '--runs',
      '2',
      '--max-rounds',
      '6',
      '--campaigns',
      '1',
      '--campaign-games',
      '2',
      '--campaign-bots',
      'gardener',
      '--out',
      out,
      '--date',
      '2026-11-10',
    ]);
    expect(code).toBe(0);
    const files = readdirSync(out).sort();
    expect(files).toContain('2026-11-10-baseline-gardener.json');
    expect(files).toContain('2026-11-10-baseline-vergleich.json');
    expect(files).toContain('2026-11-10-baseline-kampagne-gardener.json');
    const doc = JSON.parse(readFileSync(join(out, '2026-11-10-baseline-gardener.json'), 'utf8'));
    expect(Object.keys(doc)).toEqual([
      'title',
      'createdAt',
      'model',
      'bot',
      'runs',
      'scenario',
      'metrics',
      'charts',
      'notes',
    ]);
    expect(balance(['--bots', 'nope'])).toBe(1);
    expect(balance(['--scenario', 'nope'])).toBe(1);
  });

  it('Vorher/Nachher-Vergleich mit gleichen Seeds', () => {
    expect(parseVariant('Nahrung=config.rules.life.food.perPrey=2;config.rules.evolution.minAncestor=4')).toEqual({
      name: 'Nahrung',
      tweaks: ['config.rules.life.food.perPrey=2', 'config.rules.evolution.minAncestor=4'],
    });
    expect(() => parseVariant('ohne')).toThrow(/ohne Namen/);
    const out = mkdtempSync(join(tmpdir(), 'compare-'));
    const code = compare([
      '--bots',
      'greedy',
      '--runs',
      '2',
      '--max-rounds',
      '6',
      '--variant',
      'Harmonie=harmony.start=30',
      '--out',
      out,
      '--date',
      '2026-11-10',
    ]);
    expect(code).toBe(0);
    const details = JSON.parse(readFileSync(join(out, '2026-11-10-vorschlaege.details.json'), 'utf8'));
    expect(details.rows.map((r: { variant: string }) => r.variant)).toEqual(['vorher', 'Harmonie']);
    const doc = JSON.parse(readFileSync(join(out, '2026-11-10-vorschlaege.json'), 'utf8'));
    expect(doc.charts.every((c: { series: unknown[] }) => c.series.length <= 4)).toBe(true);
    expect(compare(['--bots', 'nope'])).toBe(1);
  });
});
