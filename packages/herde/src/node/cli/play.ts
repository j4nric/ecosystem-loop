/**
 * Konsolen-Partie „Die Herde“ (deutsch). Spricht mit der Engine nur über newGame, view, step.
 *
 *   npm run herde -- [--seed N] [--island start]
 *
 * Befehle: p <hand> <x> <y> (Karte legen, globale Karten ohne x y) · w (weiter, ein Monat) · s (bis zur nächsten
 * Jahreszeit) · q (beenden)
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { newGame, RuleError, step, view, type Action, type HerdeState, type HerdeView } from '../../index.ts';
import { loadData } from '../load.ts';
import { ARROW, describe, REASON } from './text.ts';

const { values: args } = parseArgs({
  options: { seed: { type: 'string', default: String(Date.now() % 1e9) }, island: { type: 'string' } },
});

const data = loadData();
const seed = Number.isFinite(Number(args.seed)) ? Number(args.seed) : args.seed!;
let state: HerdeState = newGame(data, { seed, island: args.island });
const rl = createInterface({ input: process.stdin, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();

async function ask(q: string): Promise<string> {
  process.stdout.write(q);
  const next = await lines.next();
  if (next.done) {
    console.log('\nEingabe beendet.');
    process.exit(0);
  }
  if (!process.stdin.isTTY) console.log(next.value);
  return next.value.trim();
}

const ICON: Record<string, string> = {
  sea: '~',
  steppe: '.',
  meadow: 'W',
  bush: 'b',
  forest: 'F',
  old: 'A',
  burnt: 'x',
  river: 'R',
  rock: '#',
};

function render(v: HerdeView): void {
  const month = data.months[v.monthOfYear]?.de ?? String(v.monthOfYear);
  const season = data.seasons.find((s) => s.id === v.season)?.name.de ?? v.season;
  console.log(
    `\n══ Jahr ${v.year} · ${month} · ${season}${v.ice.active ? ` · EISZEIT noch ${v.ice.monthsLeft}` : ''} ══  ` +
      `Herde ${v.herd.size} · Vorrat ${v.herd.fat}/${v.herd.fatMax} · Wölfe ${v.packs.reduce((a, p) => a + p.size, 0)} · ` +
      `Wildnis ${Math.floor(v.wild.value)}/${v.wild.max}`,
  );
  console.log('    ' + Array.from({ length: v.width }, (_, x) => `${x}`.padEnd(4)).join(''));
  for (let y = 0; y < v.height; y++) {
    const row = v.cells
      .filter((c) => c.y === y)
      .map((c) => {
        const ch = ICON[c.land] ?? c.land[0]!.toUpperCase();
        const food = c.maxFood > 0 ? String(c.food) : ' ';
        const pack = v.packs.find((p) => p.id === c.pack);
        const mark = c.herd ? '@' : pack ? 'w' : v.intent && v.intent.x === c.x && v.intent.y === c.y ? '*' : ' ';
        return `${ch}${food}${mark}${pack && !c.herd ? pack.size : ' '}`;
      });
    console.log(`${String(y).padStart(2)}  ${row.join('')}`);
  }
  console.log(
    'Legende: ~ Meer . Steppe W Wiese b Busch F Wald A Altwald x Brand R Wasser # Fels · Ziffer = Futter · @ Herde · w Wölfe · * Ziel',
  );
  if (v.intent) console.log(`Die Herde ${REASON[v.intent.reason]} ${ARROW[`${v.intent.dx},${v.intent.dy}`]}`);
  v.hand.forEach((h) => {
    const card = data.cards.get(h.card)!;
    const where = h.global ? 'ganze Insel' : h.targets.length ? `${h.targets.length} Ziele` : 'kein Ziel';
    console.log(`  [${h.index}] ${card.name.de} – ${card.text.de} (Wildnis +${h.wild}, ${where})`);
  });
}

function run(action: Action): void {
  const r = step(data, state, action);
  state = r.state;
  for (const e of r.events) {
    const t = describe(data, e);
    if (t) console.log(`  · ${t}`);
  }
}

console.log(`Being God – Die Herde · Seed ${state.seed}. Befehle: p <hand> <x> <y> · w (Monat) · s (Jahreszeit) · q`);
while (!state.over) {
  render(view(data, state));
  const [cmd, ...rest] = (await ask('> ')).split(/\s+/);
  try {
    if (cmd === 'q') break;
    if (cmd === 'w' || cmd === '') run({ type: 'advance' });
    else if (cmd === 's') {
      do run({ type: 'advance' });
      while (!state.over && state.month % data.monthsPerSeason !== 0);
    } else if (cmd === 'p') {
      const [hand, x, y] = rest.map(Number);
      run({ type: 'play', hand: hand ?? -1, ...(x !== undefined && y !== undefined ? { x, y } : {}) });
    } else console.log('Unbekannter Befehl.');
  } catch (e) {
    if (e instanceof RuleError) console.log(`Nicht möglich: ${e.message}`);
    else throw e;
  }
}
if (state.over) render(view(data, state));
rl.close();
