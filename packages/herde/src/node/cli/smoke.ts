/**
 * Absturz-Test: Zufalls-Bots spielen Partien bis zum Ende und prüfen jeden Zustand mit validateState.
 * Keine Messung (Logik vor Balancing) – Ausgabe nur zur Kontrolle.
 *
 *   npm run herde:smoke -- [--runs 20] [--seed 1] [--max-months 600]
 */
import { parseArgs } from 'node:util';
import { playRandomGame } from '../../index.ts';
import { loadData } from '../load.ts';

const { values: a } = parseArgs({
  options: {
    runs: { type: 'string', default: '20' },
    seed: { type: 'string', default: '1' },
    'max-months': { type: 'string', default: '600' },
  },
});
const runs = Number(a.runs);
const first = Number(a.seed);
const maxMonths = Number(a['max-months']);
if (![runs, first, maxMonths].every(Number.isInteger) || runs < 1) {
  console.error('--runs, --seed und --max-months müssen ganze Zahlen sein');
  process.exit(1);
}

const data = loadData();
const t0 = performance.now();
let unfinished = 0;
const reached = new Map<string, number>();
for (let i = 0; i < runs; i++) {
  const seed = first + i;
  const r = playRandomGame(data, { seed, maxMonths, check: true });
  if (!r.outcome) unfinished++;
  for (const st of r.stages) reached.set(st, (reached.get(st) ?? 0) + 1);
  console.log(
    `Seed ${seed}: ${r.outcome ?? 'abgebrochen'} nach ${r.months} Monaten · ${r.survivors} Tiere · ${r.plays} Karten · ${r.events} Ereignisse · Stufen ${r.stages.join(' → ')}`,
  );
}
console.log(`${runs} Partien ohne Absturz in ${Math.round(performance.now() - t0)} ms.`);
console.log(`Erreichte Stufen: ${[...data.stages.keys()].map((id) => `${id} ${reached.get(id) ?? 0}`).join(' · ')}`);
if (unfinished > 0) {
  console.error(`${unfinished} Partie(n) nach ${maxMonths} Monaten nicht beendet.`);
  process.exit(1);
}
