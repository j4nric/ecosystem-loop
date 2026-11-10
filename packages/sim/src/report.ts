/**
 * Ausgabe der Messung: Konsolentabelle und Cockpit-Format (`simruns`, siehe docs/cockpit/README.md).
 * Diagramme mit höchstens 4 Reihen, Kennzahlen mit Einheit, eine Notiz mit dem Befund in einem Satz.
 */

import { median, percentile, type BotReport, type GameRecord } from './metrics.ts';
import type { CampaignResult } from './campaign.ts';

export interface SimRun {
  title: string;
  createdAt: string;
  model: string;
  bot: string;
  runs: number;
  scenario: string;
  metrics: { label: string; value: number | string; unit: string }[];
  charts: {
    title: string;
    xLabel: string;
    yFormat: 'pct' | 'num';
    x: (number | string)[];
    series: { name: string; values: (number | null)[] }[];
    caption: string;
  }[];
  notes: string;
}

export interface RunMeta {
  createdAt: string;
  model: string;
}

const pct = (n: number) => Math.round(n * 1000) / 10;
const r1 = (n: number | null) => (n === null ? '–' : String(Math.round(n * 10) / 10));
const fmtPct = (n: number) => `${pct(n)} %`;

/** Zielwerte aus dem Entwicklungsplan (Phase 6). */
export const TARGETS = {
  roundsMedian: [30, 60] as const,
  tier6Year: [5, 7] as const,
  humanShare: [0.05, 0.2] as const,
};

const inRange = (v: number | null, [lo, hi]: readonly [number, number]) => v !== null && v >= lo && v <= hi;

/** Befund in einem Satz: Abweichungen von den Zielwerten. */
export function finding(r: BotReport): string {
  const parts: string[] = [];
  const m = r.rounds.median;
  parts.push(
    inRange(m, TARGETS.roundsMedian)
      ? `Partielänge im Ziel (Median ${r1(m)} Runden)`
      : `Partien ${m !== null && m > TARGETS.roundsMedian[1] ? 'zu lang' : 'zu kurz'} (Median ${r1(m)} statt 30–60 Runden)`,
  );
  const t6 = r.tiers[6];
  parts.push(
    t6 && t6.share > 0
      ? `Stufe 6 in ${fmtPct(t6.share)} der Partien, Median Jahr ${r1(t6.medianYear)} (Ziel 5–7)`
      : 'Stufe 6 nie erreicht (Ziel Jahr 5–7)',
  );
  parts.push(`Mensch in ${fmtPct(r.humanShare)} (Ziel 5–20 %)`);
  return parts.join('; ') + '.';
}

export function toSimRun(r: BotReport, meta: RunMeta, title: string): SimRun {
  const highest = Math.max(0, ...Object.entries(r.highestTier).map(([t, s]) => (s > 0 ? Number(t) : 0)));
  const t6 = r.tiers[6]!;
  const causes = Object.entries(r.collapseCauses).sort((a, b) => b[1] - a[1]);
  const cause = causes[0];
  const metrics: SimRun['metrics'] = [
    { label: 'Runden (Median)', value: r.rounds.median ?? 0, unit: ' Rd.' },
    { label: 'Runden P10–P90', value: `${r.rounds.p10}–${r.rounds.p90}`, unit: ' Rd.' },
    { label: 'Partien mit Stufe 6', value: pct(t6.share), unit: ' %' },
    { label: 'Stufe 6 erreicht (Median)', value: t6.medianYear ?? '–', unit: t6.medianYear === null ? '' : '. Jahr' },
    { label: 'Partien mit Mensch', value: pct(r.humanShare), unit: ' %' },
    { label: 'Höchste Stufe (max.)', value: highest, unit: '' },
    { label: 'Punkte (Median)', value: r.score.median ?? 0, unit: ' P.' },
    { label: 'Zonen in Idealform', value: pct(r.formKinds.ideal ?? 0), unit: ' %' },
    { label: 'Zonen verödet', value: pct(r.formKinds.degraded ?? 0), unit: ' %' },
    { label: 'Odem ungenutzt je Runde', value: r.breath.unusedPerRound, unit: ' Odem' },
    { label: 'Odem verfallen je Runde', value: r.breath.wastedPerRound, unit: ' Odem' },
    {
      label: `Kollapsgrund Nr. 1 (${cause ? cause[0] : '–'})`,
      value: cause ? pct(cause[1]) : 0,
      unit: ' %',
    },
  ];
  const x = r.byYear.years;
  const charts: SimRun['charts'] = [
    {
      title: 'Verlauf über die Jahre',
      xLabel: 'Jahr',
      yFormat: 'pct',
      x,
      series: [
        { name: 'Partie läuft noch', values: r.byYear.alive },
        { name: 'Stufe 5 erreicht', values: r.byYear.tier5 },
        { name: 'Stufe 6 erreicht', values: r.byYear.tier6 },
        { name: 'Mensch entstanden', values: r.byYear.human },
      ],
      caption: 'Anteil aller Partien am Ende des Jahres (kumuliert für die Stufen).',
    },
    {
      title: 'Harmonie am Jahresende',
      xLabel: 'Jahr',
      yFormat: 'num',
      x,
      series: [
        { name: 'P10', values: r.byYear.harmonyP10 },
        { name: 'Median', values: r.byYear.harmonyMedian },
        { name: 'P90', values: r.byYear.harmonyP90 },
      ],
      caption: 'Harmonie (0–100) der Partien, die das Jahresende erreichen.',
    },
  ];
  const parts = Object.entries(r.harmonyPerRound).sort((a, b) => a[1] - b[1]);
  charts.push({
    title: 'Harmonie-Quellen je Runde',
    xLabel: 'Quelle',
    yFormat: 'num',
    x: parts.map(([k]) => k),
    series: [{ name: 'Ø Beitrag je Runde', values: parts.map(([, v]) => v) }],
    caption: 'Mittlerer Beitrag zur Harmonie je Runde und Quelle über alle Partien.',
  });
  return {
    title,
    createdAt: meta.createdAt,
    model: meta.model,
    bot: r.bot,
    runs: r.runs,
    scenario: r.scenario,
    metrics,
    charts,
    notes: finding(r),
  };
}

/** Vergleich mehrerer Bots in einem Messlauf (höchstens 4 Reihen je Diagramm). */
export function comparisonSimRun(reports: readonly BotReport[], meta: RunMeta, title: string): SimRun {
  const shown = reports.slice(0, 4);
  const years = Math.max(...shown.map((r) => r.byYear.years.length));
  const x = Array.from({ length: years }, (_, i) => i + 1);
  const pad = (v: number[]) => x.map((_, i) => v[i] ?? 0);
  // Bester Bot für hohes Leben: höchste Stufe, die überhaupt erreicht wird, und dort der größte Anteil.
  const top = Math.max(
    ...reports.map((r) =>
      Math.max(
        0,
        ...Object.entries(r.tiers)
          .filter(([, t]) => t.share > 0)
          .map(([k]) => Number(k)),
      ),
    ),
  );
  const best = [...reports].sort((a, b) => (b.tiers[top]?.share ?? 0) - (a.tiers[top]?.share ?? 0))[0]!;
  return {
    title,
    createdAt: meta.createdAt,
    model: meta.model,
    bot: shown.map((r) => r.bot).join(', '),
    runs: reports.reduce((s, r) => s + r.runs, 0),
    scenario: reports[0]?.scenario ?? '',
    metrics: reports.flatMap((r) => [
      { label: `${r.bot}: Runden (Median)`, value: r.rounds.median ?? 0, unit: ' Rd.' },
    ]),
    charts: [
      {
        title: 'Partien, die noch laufen',
        xLabel: 'Jahr',
        yFormat: 'pct',
        x,
        series: shown.map((r) => ({ name: r.bot, values: pad(r.byYear.alive) })),
        caption: 'Anteil der Partien, die am Ende des Jahres noch nicht kollabiert sind.',
      },
      {
        title: 'Stufe 6 erreicht (kumuliert)',
        xLabel: 'Jahr',
        yFormat: 'pct',
        x,
        series: shown.map((r) => ({
          name: r.bot,
          values: x.map((_, i) => r.byYear.tier6[i] ?? r.byYear.tier6.at(-1) ?? 0),
        })),
        caption:
          'Anteil der Partien, in denen bis zum Jahresende eine Art der Stufe 6 gelebt hat. Ziel: Median Jahr 5–7.',
      },
      {
        title: 'Punkte (Median)',
        xLabel: 'Bot',
        yFormat: 'num',
        x: shown.map((r) => r.bot),
        series: [{ name: 'Median', values: shown.map((r) => r.score.median) }],
        caption: 'Punkte je Partie (Median). Keine Strategie soll dominieren.',
      },
    ],
    notes: `Bester Bot für hohes Leben: ${best.bot} (Stufe ${top} in ${fmtPct(best.tiers[top]?.share ?? 0)} der Partien); ${finding(best)}`,
  };
}

/** Kennzahlen einer Gruppe von Partien (für Kampagnen). */
export function groupStats(recs: readonly GameRecord[]) {
  const ok = recs.filter((r) => r.error === null);
  const n = Math.max(1, ok.length);
  return {
    rounds: median(ok.map((r) => r.rounds)),
    score: median(ok.map((r) => r.score)),
    tier: median(ok.map((r) => r.highestTier)),
    tier5: ok.filter((r) => r.highestTier >= 5).length / n,
    tier6: ok.filter((r) => r.highestTier >= 6).length / n,
    human: ok.filter((r) => r.human).length / n,
    roundsP10: percentile(
      ok.map((r) => r.rounds),
      0.1,
    ),
  };
}

export function campaignSimRun(bot: string, c: CampaignResult, meta: RunMeta, title: string, scenario: string): SimRun {
  const k = c.games.length;
  const x = Array.from({ length: k }, (_, i) => i + 1);
  const g = c.games.map(groupStats);
  const ctl = c.control.map(groupStats);
  const last = g[k - 1]!;
  const lastCtl = ctl[k - 1]!;
  const delta = (a: number | null, b: number | null) => (a === null || b === null ? 0 : Math.round((a - b) * 10) / 10);
  const relRounds = lastCtl.rounds ? Math.round(((last.rounds ?? 0) / lastCtl.rounds - 1) * 1000) / 10 : 0;
  return {
    title,
    createdAt: meta.createdAt,
    model: meta.model,
    bot,
    runs: c.games[0]!.length * k,
    scenario,
    metrics: [
      { label: `Runden Partie 1 (Median)`, value: g[0]!.rounds ?? 0, unit: ' Rd.' },
      { label: `Runden Partie ${k} (Median)`, value: last.rounds ?? 0, unit: ' Rd.' },
      { label: `Partie ${k} vs. ohne Buch (Runden)`, value: relRounds, unit: ' %' },
      { label: `Punkte Partie ${k} vs. ohne Buch`, value: delta(last.score, lastCtl.score), unit: ' P.' },
      {
        label: `Stufe 6 Partie ${k} vs. ohne Buch`,
        value: delta(pct(last.tier6), pct(lastCtl.tier6)),
        unit: ' %-Pkt.',
      },
      { label: `Kartenpool vor Partie ${k}`, value: Math.round(c.poolSize[k - 1]! * 10) / 10, unit: ' Karten' },
    ],
    charts: [
      {
        title: 'Runden je Partie der Kampagne',
        xLabel: 'Partie',
        yFormat: 'num',
        x,
        series: [
          { name: 'mit Schöpfungsbuch', values: g.map((s) => s.rounds) },
          { name: 'ohne Buch (gleiche Seeds)', values: ctl.map((s) => s.rounds) },
        ],
        caption: 'Median der Runden. Kontrolle: gleiche Seeds und Szenarien, Startdeck aus dem leeren Buch.',
      },
      {
        title: 'Hohes Leben je Partie der Kampagne',
        xLabel: 'Partie',
        yFormat: 'pct',
        x,
        series: [
          { name: 'Stufe 6 mit Buch', values: g.map((s) => s.tier6) },
          { name: 'Stufe 6 ohne Buch', values: ctl.map((s) => s.tier6) },
          { name: 'Stufe 5 mit Buch', values: g.map((s) => s.tier5) },
          { name: 'Stufe 5 ohne Buch', values: ctl.map((s) => s.tier5) },
        ],
        caption: 'Anteil der Partien, in denen eine Art der Stufe 5 bzw. 6 gelebt hat.',
      },
      {
        title: 'Meilensteine erreicht',
        xLabel: 'nach Partie',
        yFormat: 'pct',
        x,
        series: Object.entries(c.milestones)
          .slice(0, 4)
          .map(([id, v]) => ({ name: id, values: v.map((n) => Math.round(n * 1000) / 1000) })),
        caption: 'Anteil der Kampagnen, die den Meilenstein bis zu dieser Partie erreicht haben.',
      },
    ],
    notes:
      `Freischaltungen: Partie ${k} mit Buch ${r1(last.rounds)} statt ${r1(lastCtl.rounds)} Runden ohne Buch (${relRounds >= 0 ? '+' : ''}${relRounds} %), ` +
      `Stufe 6 in ${fmtPct(last.tier6)} statt ${fmtPct(lastCtl.tier6)}.`,
  };
}

/** Kompakte Konsolentabelle: eine Zeile je Bot. */
export function table(reports: readonly BotReport[]): string {
  const head = [
    'Bot',
    'N',
    'Rd. Med',
    'P10–P90',
    'Pkt Med',
    'St.5',
    'St.6',
    'J. St.6',
    'Mensch',
    'ideal',
    'verödet',
    'Odem frei',
    'Odem verf.',
  ];
  const rows = reports.map((r) => [
    r.bot,
    String(r.runs),
    r1(r.rounds.median),
    `${r1(r.rounds.p10)}–${r1(r.rounds.p90)}`,
    r1(r.score.median),
    fmtPct(r.tiers[5]?.share ?? 0),
    fmtPct(r.tiers[6]?.share ?? 0),
    r1(r.tiers[6]?.medianYear ?? null),
    fmtPct(r.humanShare),
    fmtPct(r.formKinds.ideal ?? 0),
    fmtPct(r.formKinds.degraded ?? 0),
    String(r.breath.unusedPerRound),
    String(r.breath.wastedPerRound),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

/** Ausführlicher Text je Bot (Kollapsgründe, Harmonie-Quellen, Arten, Formen, Karten). */
export function details(r: BotReport): string {
  const kv = (o: Record<string, number>, f: (n: number) => string) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${f(v)}`)
      .join(', ');
  return [
    `## ${r.bot} (${r.runs} Partien, Szenario ${r.scenario}, Rundenlimit erreicht: ${r.survived}, Fehler: ${r.errors.length})`,
    `  Kollapsgründe: ${kv(r.collapseCauses, fmtPct)}`,
    `  Harmonie je Runde: ${kv(r.harmonyPerRound, (n) => String(n))}`,
    `  Höchste Stufe: ${Object.entries(r.highestTier)
      .map(([t, s]) => `${t}: ${fmtPct(s)}`)
      .join(', ')}`,
    `  Stufen (Anteil, Median-Jahr): ${Object.entries(r.tiers)
      .map(([t, s]) => `${t}: ${fmtPct(s.share)} J${r1(s.medianYear)}`)
      .join(', ')}`,
    `  Arten gelebt: ${kv(r.speciesShare, fmtPct)}`,
    `  Aussterben (Anteil Partien): ${kv(r.extinctionShare, fmtPct)}`,
    `  Formarten: ${kv(r.formKinds, fmtPct)}`,
    `  Häufigste Formen: ${r.topForms.map(([f, s]) => `${f} ${fmtPct(s)}`).join(', ')}`,
    `  Ø höchste Zonenstufe: ${kv(r.maxLevel, (n) => String(n))}`,
    `  Odem je Runde: ausgegeben ${r.breath.spentPerRound}, ungenutzt ${r.breath.unusedPerRound}, verfallen ${r.breath.wastedPerRound}, Runden an der Obergrenze ${fmtPct(r.breath.capShare)}`,
    `  Karten je Partie: ${r.topCards.map(([c, n]) => `${c} ${n}`).join(', ')} · Züge je Runde ${r.playsPerRound}`,
    `  Ereignisse je Partie: eingetreten ${r.eventsPerGame.occurred}, abgewendet ${r.eventsPerGame.cancelled}`,
    `  Evolutions-Trichter (Anteil Runden: Vorfahr ≥ min / Sonderbed. / Lebensraum / Zonenstufe / Selektionsdruck):`,
    ...Object.entries(r.funnel).map(
      ([sp, f]) =>
        `    ${sp.padEnd(13)} ${Object.values(f)
          .map((v) => fmtPct(v).padStart(7))
          .join(' ')}`,
    ),
  ].join('\n');
}
