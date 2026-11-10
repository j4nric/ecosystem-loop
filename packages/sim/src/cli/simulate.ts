/**
 * Absturz-Test mit Bots.
 *
 *   npm run sim -- [--bot random|greedy] [--runs 20] [--scenario standard|random|…] [--seed 1] [--max-rounds 120]
 */
import { parseArgs } from 'node:util';
import { loadGameData } from '@being-god/core/node';
import { BOT_NAMES, type BotName } from '../bots.ts';
import { simulate } from '../sim.ts';

const { values: a } = parseArgs({
  options: {
    bot: { type: 'string', default: 'random' },
    runs: { type: 'string', default: '20' },
    scenario: { type: 'string', default: 'random' },
    seed: { type: 'string', default: '1' },
    'max-rounds': { type: 'string', default: '120' },
  },
});

if (!BOT_NAMES.includes(a.bot as BotName)) {
  console.error(`--bot muss ${BOT_NAMES.join(' oder ')} sein`);
  process.exit(1);
}
const data = loadGameData();
if (a.scenario !== 'random' && !data.scenarios.has(a.scenario!)) {
  console.error(`Unbekanntes Szenario: ${a.scenario} (bekannt: ${[...data.scenarios.keys()].join(', ')}, random)`);
  process.exit(1);
}

const t0 = performance.now();
const s = simulate(data, {
  bot: a.bot as BotName,
  runs: Number(a.runs),
  seed: a.seed!,
  scenario: a.scenario!,
  maxRounds: Number(a['max-rounds']),
});
const secs = ((performance.now() - t0) / 1000).toFixed(1);

console.log(`Bot ${a.bot} · Szenario ${a.scenario} · ${s.runs} Partien · ${secs} s`);
console.log(`  Kollaps: ${s.collapsed} · Rundenlimit (${a['max-rounds']}): ${s.runs - s.collapsed - s.errors.length}`);
console.log(`  Ø Runden: ${s.avgRounds.toFixed(1)}`);
console.log(`  Fehler: ${s.errors.length}`);
for (const e of s.errors) console.log(`    Seed ${e.seed} (${e.scenario}): ${e.error}`);
if (s.errors.length > 0) process.exit(1);
