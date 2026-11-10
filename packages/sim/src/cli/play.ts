/**
 * Interaktive Konsolen-Partie (deutsch). Spricht mit der Engine nur über newGame, view, legalPlays und step.
 *
 *   npm run play -- [--seed X] [--scenario standard|drought|wet|fragile]
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import {
  legalPlays,
  newGame,
  RuleError,
  step,
  view,
  type Action,
  type GameData,
  type GameEvent,
  type GameState,
  type GameView,
  type Targets,
} from '@being-god/core';
import { loadGameData } from '@being-god/core/node';

const { values: args } = parseArgs({
  options: {
    seed: { type: 'string' },
    scenario: { type: 'string', default: 'standard' },
  },
});

const data = loadGameData();
const rl = createInterface({ input: process.stdin, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();

/** Gepuffert, damit auch per Pipe eingespeiste Eingaben (Tests, Skripte) nicht verloren gehen. */
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

const KIND = { ideal: '★ ideal', normal: 'normal', degraded: '✗ verödet', disturbance: '⚡ Störung' };
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const bar = (p: number) => '▰'.repeat(Math.round(p * 3)).padEnd(3, '▱');

function render(v: GameView): void {
  console.log(
    `\n══ Runde ${v.round} · Jahr ${v.year} · ${v.season.name} ══  Harmonie ${fmt(v.harmony.value)}/${v.harmony.max} ` +
      `(${signed(Number(fmt(v.harmony.trend)))}) · Odem ${v.breath.value}/${v.breath.max} (+${v.breath.nextIncome} zur Bilanz)` +
      ` · Stapel ${v.drawPile} · Ablage ${v.discardPile}`,
  );
  v.zones.forEach((z, i) => {
    const stats = z.stats.map((s) => `${short(s.id)}${s.value}`).join(' ');
    const warn = [...new Set(z.warnings.map((w) => w.icon))].join('');
    console.log(
      `  ${i + 1}) ${z.geographyName.padEnd(10)} ${z.form.name.padEnd(20)} ${KIND[z.form.kind].padEnd(10)} ` +
        `Stufe ${z.level} ${bar(z.levelProgress)}  ${stats.padEnd(16)} ${warn}`,
    );
  });
  console.log(`  Hand (gespielt ${v.playsThisTurn}, Pflicht ${v.minPlays}):`);
  v.hand.forEach((c, i) => {
    const mark = c.playable ? ' ' : '·';
    console.log(`   ${mark}${i + 1}) ${c.name.padEnd(12)} [${c.cost} Odem] ${c.text}`);
  });
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const short = (stat: string) => data.stats.get(stat)?.short ?? stat;

function describe(d: GameData, e: GameEvent): string | null {
  const stat = (id: string) => d.stats.get(id)?.name.de ?? id;
  const zone = (id: string) => d.geographies.get(d.zones.find((z) => z.id === id)?.geography ?? '')?.name.de ?? id;
  const form = (id: string) => d.forms.get(id)?.form.name.de ?? id;
  switch (e.type) {
    case 'cardPlayed':
      return `  ▶ ${d.cards.get(e.card)?.name.de ?? e.card} auf ${Object.values(e.targets).map(zone).join(' → ') || 'alle'}`;
    case 'triggered': {
      const t = d.cards.get(e.card)?.triggers.find((x) => x.id === e.trigger);
      return `    ${t?.icon ?? '!'} ${t?.name.de ?? e.trigger} in ${zone(e.zone)}${e.disturbance ? ' (Störung)' : ''}`;
    }
    case 'statChanged':
      return `    ${zone(e.zone)}: ${stat(e.stat)} ${e.from} → ${e.to}  (${cause(d, e.cause)})`;
    case 'formChanged':
      return `  ◆ ${zone(e.zone)} wird ${form(e.to)} (vorher ${form(e.from)})`;
    case 'levelChanged':
      return `  ◆ ${zone(e.zone)}: Stufe ${e.from} → ${e.to}${e.reason === 'rise' ? '' : ` (${LEVEL_REASON[e.reason]})`}`;
    case 'harmonyChanged':
      return `  ♥ Harmonie ${fmt(e.from)} → ${fmt(e.to)}`;
    case 'breathChanged':
      return e.cause === 'income' ? `  ✦ Odem ${e.from} → ${e.to}` : null;
    case 'deckReshuffled':
      return `  ↻ Ablage gemischt (${e.cards} Karten)`;
    case 'collapsed':
      return `\n  ☠ Die Welt kollabiert in Runde ${e.round}.`;
    case 'seasonApplied':
      return `  ~ ${d.seasons.find((s) => s.id === e.season)?.name.de ?? e.season} wirkt`;
    case 'couplingApplied':
      return `  ~ ${d.couplings.find((c) => c.id === e.coupling)?.name.de ?? e.coupling}: ${zone(e.from)} → ${zone(e.to)}`;
    case 'roundStarted':
    case 'cardDrawn':
    case 'disturbance':
    case 'turnEnded':
      return null;
  }
}

const LEVEL_REASON = { rise: 'Aufstieg', disturbance: 'Störung', degraded: 'verödet', formChanged: 'Formwechsel' };

function cause(d: GameData, c: string): string {
  const [kind, id = ''] = c.split(':');
  if (kind === 'card') return d.cards.get(id)?.name.de ?? id;
  if (kind === 'trigger') return 'Schwelle';
  if (kind === 'season') return d.seasons.find((s) => s.id === id)?.name.de ?? id;
  if (kind === 'coupling') return d.couplings.find((x) => x.id === id)?.name.de ?? id;
  if (kind === 'healing') return 'Selbstheilung';
  return c;
}

/** Ziele Slot für Slot aus den legalen Zügen dieser Karte wählen. */
async function chooseTargets(v: GameView, s: GameState, uid: number): Promise<Targets | null> {
  const card = v.hand.find((c) => c.uid === uid)!;
  let options = legalPlays(data, s).filter((p) => p.uid === uid);
  const chosen: Targets = {};
  for (const slot of card.slots) {
    const values = [...new Set(options.map((p) => p.targets[slot.id]!))];
    const label = (id: string) => {
      const z = v.zones.find((x) => x.id === id)!;
      return `${v.zones.indexOf(z) + 1}=${z.geographyName}`;
    };
    let pickd: string | undefined;
    if (values.length === 1) {
      pickd = values[0]!;
      console.log(`  ${slot.label}: ${label(pickd)}`);
    } else {
      const a = await ask(`  ${slot.label}? ${values.map(label).join('  ')}  (leer = abbrechen): `);
      if (!a) return null;
      pickd = v.zones[Number(a) - 1]?.id;
      if (!pickd || !values.includes(pickd)) {
        console.log('  Ungültige Auswahl.');
        return null;
      }
    }
    chosen[slot.id] = pickd;
    options = options.filter((p) => p.targets[slot.id] === pickd);
  }
  return chosen;
}

async function main(): Promise<void> {
  const seed = args.seed ?? String(Date.now());
  let state = newGame(data, { seed, scenario: args.scenario });
  console.log(`Being God (ain't easy) · Szenario ${data.scenarios.get(state.scenario)!.name.de} · Seed ${seed}`);
  console.log('Befehle: 1–9 Karte spielen · z Runde beenden · q aufhören');

  while (state.phase === 'play') {
    const v = view(data, state, 'de');
    render(v);
    const cmd = (await ask('> ')).toLowerCase();
    let action: Action | null = null;
    if (cmd === 'q') {
      console.log('Aufgehört.');
      rl.close();
      return;
    } else if (cmd === 'z') {
      if (!v.canEndTurn) console.log(`  Kartenzwang: erst mindestens ${v.minPlays} Karte spielen.`);
      else action = { type: 'endTurn' };
    } else if (/^\d+$/.test(cmd)) {
      const c = v.hand[Number(cmd) - 1];
      if (!c) console.log('  Keine solche Karte.');
      else if (!c.playable) console.log('  Diese Karte ist gerade nicht spielbar (Odem oder Ziel fehlt).');
      else {
        const targets = await chooseTargets(v, state, c.uid);
        if (targets) action = { type: 'play', uid: c.uid, targets };
      }
    }
    if (!action) continue;
    try {
      const r = step(data, state, action);
      state = r.state;
      for (const e of r.events) {
        const line = describe(data, e);
        if (line) console.log(line);
      }
    } catch (e) {
      if (e instanceof RuleError) console.log(`  ${e.message}`);
      else throw e;
    }
  }
  console.log(`\n══ Ende nach ${state.round} Runden (Jahr ${view(data, state).year}) ══`);
  rl.close();
}

void main();
