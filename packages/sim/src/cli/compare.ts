/**
 * Vorher/Nachher-Messung von Balancing-Vorschlägen: gleiche Seeds und Szenarien, einmal mit den Originaldaten,
 * einmal je Variante (Daten im Speicher geändert, siehe tweaks.ts).
 *
 *   npx tsx packages/sim/src/cli/compare.ts --bots gardener,evolver --runs 100 \
 *     --variant "Nahrungskette=config.rules.life.food.perPrey=2" \
 *     --variant "Ereignisse=config.rules.forecast.strength.max=2;config.rules.forecast.strength.perYear=0.15" \
 *     [--out packages/sim/reports] [--tag vorschlaege] [--date 2026-11-10]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { GameData } from '@being-god/core';
import { BOT_NAMES, type BotName } from '../bots.ts';
import { aggregate, recordGame, type BotReport } from '../metrics.ts';
import type { SimRun } from '../report.ts';
import { gameDataWith } from '../tweaks.ts';

export interface Variant {
  name: string;
  tweaks: string[];
}

/** "Name=a.b=1;c.d=2" → Variante. */
export function parseVariant(text: string): Variant {
  const i = text.indexOf('=');
  if (i < 0) throw new Error(`Variante ohne Namen: ${text}`);
  return {
    name: text.slice(0, i),
    tweaks: text
      .slice(i + 1)
      .split(';')
      .filter(Boolean),
  };
}

export interface Row {
  variant: string;
  bot: string;
  rounds: number | null;
  roundsP10: number | null;
  roundsP90: number | null;
  score: number | null;
  tier4: number;
  tier5: number;
  tier6: number;
  tier6Year: number | null;
  human: number;
  ideal: number;
  extinctionsPerGame: number;
}

function row(variant: string, r: BotReport, recsExt: number): Row {
  return {
    variant,
    bot: r.bot,
    rounds: r.rounds.median,
    roundsP10: r.rounds.p10,
    roundsP90: r.rounds.p90,
    score: r.score.median,
    tier4: r.tiers[4]?.share ?? 0,
    tier5: r.tiers[5]?.share ?? 0,
    tier6: r.tiers[6]?.share ?? 0,
    tier6Year: r.tiers[6]?.medianYear ?? null,
    human: r.humanShare,
    ideal: r.formKinds.ideal ?? 0,
    extinctionsPerGame: recsExt,
  };
}

export function measure(
  data: GameData,
  variant: string,
  bots: BotName[],
  runs: number,
  seed: string,
  maxRounds: number,
): Row[] {
  const scenarios = [...data.scenarios.keys()];
  return bots.map((bot) => {
    const recs = Array.from(
      { length: runs },
      (_, i) =>
        recordGame(data, { bot, seed: `${seed}:${i}`, scenario: scenarios[i % scenarios.length]!, maxRounds }).record,
    );
    const ext = recs.reduce((s, r) => s + Object.values(r.extinctions).reduce((a, b) => a + b, 0), 0) / runs;
    return row(variant, aggregate(data, bot, 'all', recs), Math.round(ext * 100) / 100);
  });
}

const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;

export function compareTable(rows: readonly Row[]): string {
  const head = [
    'Variante',
    'Bot',
    'Rd. Med',
    'P10–P90',
    'Pkt Med',
    'St.4',
    'St.5',
    'St.6',
    'J. St.6',
    'Mensch',
    'ideal',
    'Aussterben/P.',
  ];
  const body = rows.map((r) => [
    r.variant,
    r.bot,
    String(r.rounds),
    `${r.roundsP10}–${r.roundsP90}`,
    String(r.score),
    pct(r.tier4),
    pct(r.tier5),
    pct(r.tier6),
    r.tier6Year === null ? '–' : String(r.tier6Year),
    pct(r.human),
    pct(r.ideal),
    String(r.extinctionsPerGame),
  ]);
  const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)));
  const line = (c: string[]) => c.map((x, i) => x.padEnd(w[i]!)).join('  ');
  return [line(head), line(w.map((n) => '-'.repeat(n))), ...body.map(line)].join('\n');
}

export function compareSimRun(
  rows: readonly Row[],
  bots: string[],
  runs: number,
  meta: { createdAt: string; model: string },
  title: string,
): SimRun {
  const variants = [...new Set(rows.map((r) => r.variant))];
  const get = (v: string, b: string) => rows.find((r) => r.variant === v && r.bot === b)!;
  const shownBots = bots.slice(0, 2);
  return {
    title,
    createdAt: meta.createdAt,
    model: meta.model,
    bot: bots.join(', '),
    runs: runs * rows.length,
    scenario: 'all',
    // Kacheln nur für die letzten vier Varianten (die Gesamtpakete stehen am Ende), Diagramme zeigen alle.
    metrics: variants
      .slice(1)
      .slice(-4)
      .flatMap((v) =>
        shownBots.map((b) => ({
          label: `${v} · ${b}: Runden (Median) vorher → nachher`,
          value: `${get(variants[0]!, b).rounds} → ${get(v, b).rounds}`,
          unit: ' Rd.',
        })),
      ),
    charts: [
      {
        title: 'Runden (Median) je Variante',
        xLabel: 'Variante',
        yFormat: 'num',
        x: variants,
        series: shownBots.map((b) => ({ name: b, values: variants.map((v) => get(v, b).rounds) })),
        caption: 'Gleiche Seeds und Szenarien je Variante. Ziel: 30–60 Runden.',
      },
      {
        title: 'Hohes Leben je Variante',
        xLabel: 'Variante',
        yFormat: 'pct',
        x: variants,
        series: shownBots.flatMap((b) => [
          { name: `${b}: Stufe 5`, values: variants.map((v) => get(v, b).tier5) },
          { name: `${b}: Stufe 6`, values: variants.map((v) => get(v, b).tier6) },
        ]),
        caption: 'Anteil der Partien, in denen eine Art der Stufe 5 bzw. 6 gelebt hat.',
      },
    ],
    notes: `Vorher/Nachher je Vorschlag mit ${runs} Partien je Bot und Variante (gleiche Seeds).`,
  };
}

export function main(argv: string[]): number {
  const { values: a } = parseArgs({
    args: argv,
    options: {
      bots: { type: 'string', default: 'gardener,evolver' },
      runs: { type: 'string', default: '100' },
      seed: { type: 'string', default: '1' },
      'max-rounds': { type: 'string', default: '200' },
      variant: { type: 'string', multiple: true, default: [] },
      /** Ohne Messung der Originaldaten (für parallele Läufe; zusammenführen mit --merge). */
      'skip-before': { type: 'boolean', default: false },
      /** Fertige .details.json-Dateien zusammenführen statt zu messen. */
      merge: { type: 'string', multiple: true, default: [] },
      out: { type: 'string' },
      tag: { type: 'string', default: 'vorschlaege' },
      date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
      model: { type: 'string', default: 'Engine v2 · Daten-Stand main' },
    },
  });
  const bots = a.bots!.split(',') as BotName[];
  if (bots.some((b) => !BOT_NAMES.includes(b))) {
    console.error(`Bots: ${BOT_NAMES.join(', ')}`);
    return 1;
  }
  let runs = Number(a.runs);
  const maxRounds = Number(a['max-rounds']);
  const variants: Variant[] = [];
  const rows: Row[] = [];
  const merge = a.merge ?? [];
  if (merge.length > 0) {
    // Zusammenführen: Varianten und Zeilen aus fertigen Läufen in Datei-Reihenfolge, ohne neue Messung.
    for (const file of merge) {
      const d = JSON.parse(readFileSync(file, 'utf8')) as { variants: Variant[]; rows: Row[]; runs: number };
      for (const v of d.variants) if (!variants.some((x) => x.name === v.name)) variants.push(v);
      for (const r of d.rows) if (!rows.some((x) => x.variant === r.variant && x.bot === r.bot)) rows.push(r);
      runs = d.runs;
    }
  } else {
    if (!a['skip-before']) variants.push({ name: 'vorher', tweaks: [] });
    variants.push(...(a.variant ?? []).map(parseVariant));
    for (const v of variants) {
      const t0 = performance.now();
      rows.push(...measure(gameDataWith(v.tweaks), v.name, bots, runs, a.seed!, maxRounds));
      console.log(
        `${v.name}: ${v.tweaks.join(' · ') || 'Originaldaten'} (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
      );
    }
  }
  console.log('\n' + compareTable(rows));
  if (a.out) {
    mkdirSync(a.out, { recursive: true });
    const meta = { createdAt: `${a.date}T12:00:00.000Z`, model: a.model! };
    const prefix = `${a.date}-${a.tag}`;
    writeFileSync(
      join(a.out, `${prefix}.json`),
      JSON.stringify(compareSimRun(rows, bots, runs, meta, `Balancing-Vorschläge: Vorher/Nachher`), null, 2) + '\n',
    );
    writeFileSync(join(a.out, `${prefix}.details.json`), JSON.stringify({ variants, rows, runs }, null, 2) + '\n');
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
