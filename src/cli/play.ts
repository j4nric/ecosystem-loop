/**
 * Interaktive Konsolen-Expedition.
 *
 *   npm run play -- [--seed X] [--scenario standard|dry|flooded|burnt] [--deck a,b,c] [--notebook pfad]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { holdsAll } from '../core/conditions.ts';
import {
  canEndExpedition,
  canEndTurn,
  createExpedition,
  endExpedition,
  endTurn,
  getCard,
  legalPlays,
  playCard,
  report,
  RuleError,
  slotOptions,
  warnings,
} from '../core/engine.ts';
import { cardPool, emptyNotebook, isDiscovered, recordExpedition, validateDeck, type Notebook } from '../core/meta.ts';
import type { GameData } from '../core/schema.ts';
import type { Choices, ExpeditionState } from '../core/state.ts';
import { loadGameData } from '../node/load.ts';
import { defaultDeck } from '../sim/bots.ts';
import {
  animalName,
  cardName,
  describeCard,
  describeCondition,
  describeEvent,
  endLabel,
  slotPrompt,
  tag,
  zoneLabel,
} from './text.ts';

const { values: args } = parseArgs({
  options: {
    seed: { type: 'string' },
    scenario: { type: 'string', default: 'standard' },
    deck: { type: 'string' },
    notebook: { type: 'string', default: 'save/notebook.json' },
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
    console.log('\nEingabe beendet, nichts gespeichert.');
    process.exit(0);
  }
  if (!process.stdin.isTTY) console.log(next.value);
  return next.value.trim();
}

function loadNotebook(path: string): Notebook {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Notebook) : emptyNotebook();
}

function saveNotebook(path: string, nb: Notebook): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(nb, null, 2));
}

function renderState(d: GameData, s: ExpeditionState): void {
  const warn = warnings(d, s);
  console.log(`\n══ Zug ${s.turn} · Stapel ${s.drawPile.length} · Ablage ${s.discardPile.length} · gespielt ${s.playsThisTurn} ══`);
  for (const z of s.zones) {
    const v = z.values;
    const w = warn.filter((x) => x.zone === z.id).map((x) => x.icon ?? '!');
    const animals = z.animals.map((a) => animalName(d, a.id)).join(', ') || '–';
    const tags = z.tags.length ? ` [${z.tags.map(tag).join(', ')}]` : '';
    console.log(
      `  ${zoneLabel(d, s, z.id).padEnd(14)} L${v.light} F${v.moisture} D${v.density} T${v.deadwood}  ` +
        `${[...new Set(w)].join('')}`.padEnd(4) +
        ` Nachbarn ${z.neighbors.map((n) => n.toUpperCase()).join('')}${tags}  ▸ ${animals}`,
    );
  }
  console.log('  Hand:');
  s.hand.forEach((c, i) => {
    const card = getCard(d, c.card);
    console.log(`   ${i + 1}) ${card.name.de.padEnd(12)} ${describeCard(d, card)}`);
  });
  const r = report(d, s);
  console.log(`  Wertung jetzt: ${r.points} Punkte (${r.species.map((a) => animalName(d, a)).join(', ') || 'keine Tiere'})`);
}

function renderAnimals(d: GameData, s: ExpeditionState, nb: Notebook): void {
  console.log('\n  Feldnotizen:');
  for (const a of d.animals.values()) {
    if (!isDiscovered(nb, a.id)) {
      const seen = s.arrivedSpecies.includes(a.id) ? a.name.de : '???';
      console.log(`   ? ${seen.padEnd(14)} Stufe ${a.tier} – Bedingungen unbekannt (erst nach Dokumentation sichtbar)`);
      continue;
    }
    const ok = s.zones.filter((z) => holdsAll(a.conditions, { data: d, state: s, zone: z })).map((z) => z.id.toUpperCase());
    console.log(
      `   ✓ ${a.name.de.padEnd(14)} Stufe ${a.tier} – ${a.conditions.map((c) => describeCondition(d, c)).join(', ')}` +
        `  → Karte ${cardName(d, a.card)}${a.eats.length ? `, frisst ${a.eats.map((x) => animalName(d, x)).join(', ')}` : ''}` +
        (ok.length ? `  [erfüllt in ${ok.join('')}]` : ''),
    );
  }
}

async function chooseTargets(d: GameData, s: ExpeditionState, uid: number): Promise<Choices | null> {
  const card = getCard(d, s.hand.find((c) => c.uid === uid)!.card);
  const choices: Choices = {};
  for (const slot of card.slots) {
    const opts = slotOptions(d, s, slot, choices, uid);
    if (opts.length === 0) {
      console.log('  Kein gültiges Ziel.');
      return null;
    }
    const label = (o: string) =>
      slot.kind === 'animal'
        ? animalName(d, o)
        : slot.kind === 'handCard'
          ? cardName(d, s.hand.find((c) => String(c.uid) === o)!.card)
          : zoneLabel(d, s, o);
    if (opts.length === 1) {
      choices[slot.id] = opts[0]!;
      console.log(`  ${slotPrompt(slot)}: ${label(opts[0]!)}`);
      continue;
    }
    const byLetter = slot.kind === 'zone' || slot.kind === 'neighbor' || slot.kind === 'otherZone';
    const list = opts.map((o, i) => (byLetter ? label(o) : `${i + 1}=${label(o)}`)).join('  ');
    const a = (await ask(`  ${slotPrompt(slot)}? ${list}  (leer = abbrechen): `)).toLowerCase();
    if (!a) return null;
    const pickd = byLetter ? opts.find((o) => o === a) : opts[Number(a) - 1];
    if (!pickd) {
      console.log('  Ungültige Auswahl.');
      return null;
    }
    choices[slot.id] = pickd;
  }
  return choices;
}

async function main(): Promise<void> {
  const nb = loadNotebook(args.notebook!);
  const deck = args.deck ? args.deck.split(',').map((x) => x.trim()) : defaultDeck(data, nb);
  const problems = validateDeck(data, nb, deck);
  if (problems.length) {
    console.error(`Deck ungültig:\n  ${problems.join('\n  ')}\nPool: ${cardPool(data, nb).join(', ')}`);
    process.exit(1);
  }
  const s = createExpedition(data, { deck, scenario: args.scenario, seed: args.seed ?? Date.now() });
  console.log(`Expedition ${nb.expeditions + 1} · Szenario ${data.scenarios.get(s.scenario)!.name.de}`);
  console.log(`Deck: ${deck.map((c) => cardName(data, c)).join(', ')}`);
  console.log('Befehle: 1–9 Karte spielen · z Zug beenden · x Expedition beenden · t Tiere · q abbrechen');

  let seen = s.log.length;
  const flush = () => {
    for (const e of s.log.slice(seen)) {
      const line = describeEvent(data, s, e);
      if (line) console.log(line);
    }
    seen = s.log.length;
  };

  while (s.phase === 'play') {
    renderState(data, s);
    const cmd = (await ask('> ')).toLowerCase();
    try {
      if (cmd === 'q') {
        console.log('Abgebrochen, nichts gespeichert.');
        rl.close();
        return;
      } else if (cmd === 't') {
        renderAnimals(data, s, nb);
      } else if (cmd === 'z') {
        if (!canEndTurn(data, s)) console.log(`  Kartenzwang: erst mindestens ${data.config.hand.minPlaysPerTurn} Karte spielen.`);
        else endTurn(data, s);
      } else if (cmd === 'x') {
        if (!canEndExpedition(s)) console.log('  Aussteigen geht nur zu Zugbeginn.');
        else endExpedition(s);
      } else if (/^\d+$/.test(cmd)) {
        const inst = s.hand[Number(cmd) - 1];
        if (!inst) console.log('  Keine solche Karte.');
        else if (!legalPlays(data, s).some((p) => p.uid === inst.uid)) console.log('  Diese Karte ist gerade nicht spielbar.');
        else {
          const choices = await chooseTargets(data, s, inst.uid);
          if (choices) playCard(data, s, inst.uid, choices);
        }
      }
    } catch (e) {
      if (e instanceof RuleError) console.log(`  ${e.message}`);
      else throw e;
    }
    flush();
  }

  const r = report(data, s);
  const fresh = recordExpedition(data, nb, s);
  saveNotebook(args.notebook!, nb);
  console.log(`\n══ Feldbericht (${endLabel(s.endReason!)}) nach ${s.turn} Zügen ══`);
  console.log(`  Dokumentiert: ${r.species.map((a) => animalName(data, a)).join(', ') || 'nichts'}`);
  console.log(`  Punkte: ${r.points} · höchste Stufe: ${r.highestTier}`);
  if (fresh.length) console.log(`  Neu im Notizbuch: ${fresh.map((a) => animalName(data, a)).join(', ')}`);
  console.log(`  Notizbuch gespeichert: ${args.notebook}`);
  rl.close();
}

void main();
