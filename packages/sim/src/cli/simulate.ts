/**
 * Balancing-Simulation: viele Kampagnen mit Bots.
 *
 *   npm run sim -- [--bot greedy|random] [--runs 200] [--expeditions 4] [--seed 1] [--scenario standard|random] [--json]
 */
import { parseArgs } from 'node:util';
import { loadGameData } from '@being-god/core/node';
import type { BotName } from '../bots.ts';
import { simulate } from '../campaign.ts';
import { animalName } from './text.ts';

const { values: a } = parseArgs({
  options: {
    bot: { type: 'string', default: 'greedy' },
    runs: { type: 'string', default: '200' },
    expeditions: { type: 'string', default: '4' },
    seed: { type: 'string', default: '1' },
    scenario: { type: 'string', default: 'standard' },
    json: { type: 'boolean', default: false },
  },
});

if (a.bot !== 'greedy' && a.bot !== 'random') {
  console.error('--bot muss greedy oder random sein');
  process.exit(1);
}

const data = loadGameData();
const t0 = performance.now();
const summary = simulate(data, {
  bot: a.bot as BotName,
  runs: Number(a.runs),
  expeditions: Number(a.expeditions),
  seed: a.seed!,
  scenario: a.scenario!,
});
const ms = performance.now() - t0;

if (a.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);
  const tiers = summary.perExpedition[0]?.tierAtEnd.length ?? 0;
  console.log(
    `Bot ${a.bot} · ${a.runs} Kampagnen × ${a.expeditions} Expeditionen · Szenario ${a.scenario} · ${(ms / 1000).toFixed(1)} s\n`,
  );
  const tierHead = Array.from({ length: tiers }, (_, k) => `  S${k + 1}`.padStart(5)).join('');
  console.log(
    `Exp.  Züge  Karten  Punkte │ Stufe dokumentiert${' '.repeat(Math.max(0, tiers * 5 - 18))} │ Stufe je erreicht │ Endgrund`,
  );
  console.log(`                          │${tierHead} │${tierHead} │`);
  for (const e of summary.perExpedition) {
    const reasons = Object.entries(e.endReasons)
      .map(([k, v]) => `${k} ${Math.round(v! * 100)}%`)
      .join(', ');
    console.log(
      `${String(e.index).padStart(4)}  ${e.avgTurns.toFixed(1).padStart(4)}  ${e.avgCardsPlayed.toFixed(1).padStart(6)}  ${e.avgPoints.toFixed(1).padStart(6)} │` +
        `${e.tierAtEnd.map(pct).join('')} │${e.tierSeen.map(pct).join('')} │ ${reasons}`,
    );
  }
  console.log('\nIm Notizbuch bis Expedition k (Anteil der Kampagnen):');
  console.log(`  ${'Tier'.padEnd(20)}${summary.perExpedition.map((e) => `  E${e.index}`.padStart(5)).join('')}`);
  for (const [id, xs] of Object.entries(summary.discoveredBy)) {
    const tier = data.animals.get(id)!.tier;
    console.log(`  ${`${animalName(data, id)} (S${tier})`.padEnd(20)}${xs.map(pct).join('')}`);
  }
}
