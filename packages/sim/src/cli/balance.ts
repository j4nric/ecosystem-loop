/**
 * Balancing-Messung (Phase 6): je Bot N Partien über alle Szenarien, Kennzahlen als Tabelle und optional als
 * JSON im Cockpit-Format (`simruns`). Dazu Kampagnen mit Schöpfungsbuch (Wirkung der Freischaltungen).
 *
 *   npm run balance -w packages/sim -- [--bots gardener,evolver] [--runs 200] [--scenario all|random|<id>]
 *     [--campaigns 40] [--campaign-games 5] [--campaign-bots gardener,evolver] [--seed 1] [--max-rounds 200]
 *     [--out packages/sim/reports] [--tag baseline] [--date 2026-11-10] [--model "Engine v2"]
 *     [--tweak config.rules.life.food.perPrey=2 …]   (Daten-Variante im Speicher, siehe tweaks.ts)
 *
 * Auch erreichbar über `npm run sim -- --report …`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BOT_NAMES, type BotName } from '../bots.ts';
import { runCampaigns } from '../campaign.ts';
import { aggregate, recordGame, type GameRecord } from '../metrics.ts';
import { gameDataWith } from '../tweaks.ts';
import { campaignSimRun, comparisonSimRun, details, groupStats, table, toSimRun, type RunMeta } from '../report.ts';

export function main(argv: string[]): number {
  const { values: a } = parseArgs({
    args: argv,
    options: {
      report: { type: 'boolean', default: false },
      bots: { type: 'string', default: BOT_NAMES.join(',') },
      runs: { type: 'string', default: '200' },
      scenario: { type: 'string', default: 'all' },
      campaigns: { type: 'string', default: '40' },
      'campaign-games': { type: 'string', default: '5' },
      'campaign-bots': { type: 'string', default: 'gardener,evolver' },
      seed: { type: 'string', default: '1' },
      'max-rounds': { type: 'string', default: '200' },
      out: { type: 'string' },
      tag: { type: 'string', default: 'baseline' },
      date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
      model: { type: 'string', default: 'Engine v2 · Daten-Stand main' },
      tweak: { type: 'string', multiple: true, default: [] },
    },
  });
  const tweaks = a.tweak ?? [];
  const data = gameDataWith(tweaks);
  if (tweaks.length > 0) console.log(`Daten-Variante: ${tweaks.join(' · ')}\n`);
  const bots = a.bots!.split(',').filter(Boolean) as BotName[];
  const bad = bots.filter((b) => !BOT_NAMES.includes(b));
  if (bad.length > 0) {
    console.error(`Unbekannte Bots: ${bad.join(', ')} (bekannt: ${BOT_NAMES.join(', ')})`);
    return 1;
  }
  const all = [...data.scenarios.keys()];
  const scenario = a.scenario!;
  if (scenario !== 'all' && scenario !== 'random' && !data.scenarios.has(scenario)) {
    console.error(`Unbekanntes Szenario: ${scenario} (bekannt: ${all.join(', ')}, all, random)`);
    return 1;
  }
  const runs = Number(a.runs);
  const maxRounds = Number(a['max-rounds']);
  const scenarioFor = (i: number) => (scenario === 'all' || scenario === 'random' ? all[i % all.length]! : scenario);
  const meta: RunMeta = { createdAt: `${a.date}T12:00:00.000Z`, model: a.model! };
  const prefix = `${a.date}-${a.tag}`;
  const files: [string, unknown][] = [];

  const reports = [];
  let errors = 0;
  for (const bot of bots) {
    const t0 = performance.now();
    const recs: GameRecord[] = [];
    for (let i = 0; i < runs; i++)
      recs.push(recordGame(data, { bot, seed: `${a.seed}:${i}`, scenario: scenarioFor(i), maxRounds }).record);
    const r = aggregate(data, bot, scenario, recs);
    errors += r.errors.length;
    reports.push(r);
    console.log(details(r));
    console.log(`  (${((performance.now() - t0) / 1000).toFixed(1)} s)\n`);
    files.push([`${prefix}-${bot}.json`, toSimRun(r, meta, `Messung ${a.tag}: ${bot}`)]);
    files.push([`${prefix}-${bot}.details.json`, r]);
  }
  if (reports.length > 0) {
    console.log(table(reports));
    // Vergleich: der Zufalls-Bot ist Referenz und nicht Teil des Diagramms (höchstens 4 Reihen).
    const compared = reports.filter((r) => r.bot !== 'random');
    files.push([
      `${prefix}-vergleich.json`,
      comparisonSimRun(compared.length ? compared : reports, meta, `Messung ${a.tag}: Bots im Vergleich`),
    ]);
  }

  const campaignBots = (a['campaign-bots'] ?? '').split(',').filter(Boolean) as BotName[];
  const campaigns = Number(a.campaigns);
  if (campaigns > 0)
    for (const bot of campaignBots) {
      const t0 = performance.now();
      const c = runCampaigns(data, {
        bot,
        campaigns,
        games: Number(a['campaign-games']),
        seed: `${a.seed}:kampagne`,
        scenarios: scenario === 'all' || scenario === 'random' ? all : [scenario],
        maxRounds,
      });
      const stats = c.games.map(groupStats);
      const ctl = c.control.map(groupStats);
      console.log(
        `\nKampagne ${bot} (${campaigns} × ${c.games.length} Partien, ${((performance.now() - t0) / 1000).toFixed(1)} s)`,
      );
      stats.forEach((s, k) =>
        console.log(
          `  Partie ${k + 1}: Pool ${c.poolSize[k]!.toFixed(1)} · Runden ${s.rounds} (ohne Buch ${ctl[k]!.rounds}) · ` +
            `Punkte ${s.score} (${ctl[k]!.score}) · St.6 ${(s.tier6 * 100).toFixed(0)} % (${(ctl[k]!.tier6 * 100).toFixed(0)} %) · ` +
            `Mensch ${(s.human * 100).toFixed(0)} % (${(ctl[k]!.human * 100).toFixed(0)} %)`,
        ),
      );
      console.log(
        `  Deck der letzten Partie: ${Object.entries(c.lastDeck)
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}`,
      );
      files.push([
        `${prefix}-kampagne-${bot}.json`,
        campaignSimRun(bot, c, meta, `Kampagne ${a.tag}: ${bot}`, scenario),
      ]);
      files.push([
        `${prefix}-kampagne-${bot}.details.json`,
        { games: stats, control: ctl, poolSize: c.poolSize, milestones: c.milestones, lastDeck: c.lastDeck },
      ]);
    }

  if (a.out) {
    mkdirSync(a.out, { recursive: true });
    for (const [name, doc] of files) writeFileSync(join(a.out, name), JSON.stringify(doc, null, 2) + '\n');
    console.log(`\n${files.length} Dateien nach ${a.out} geschrieben.`);
  }
  return errors > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
