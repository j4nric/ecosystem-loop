/**
 * Messung (Phase 6): Partien mit Protokoll spielen und Kennzahlen bilden.
 *
 * Eine Partie liefert einen `GameRecord` (Runden, Harmonie-Verlauf und -Quellen, Stufen, Aussterben, Formen,
 * Odem, Karten). `aggregate` fasst viele Partien eines Bots zu einem `BotReport` zusammen.
 */
import { newGame, step, type CreationBook, type GameData, type GameState } from '@being-god/core';
import { createBot, type BotName } from './bots.ts';
import { evolutionFunnel, expectedIncome, FUNNEL, paramsOf, yearAt } from './strategy.ts';

export interface GameRecord {
  bot: BotName;
  seed: string;
  scenario: string;
  rounds: number;
  collapsed: boolean;
  score: number;
  /** Harmonie am Ende jeder Bilanz (Index 0 = Runde 1). */
  harmony: number[];
  /** Summe der Harmonie-Beiträge je Quelle über die ganze Partie. */
  harmonyParts: Record<string, number>;
  /** Hauptgrund des Kollapses: stärkste negative Quelle der letzten 8 Runden (null ohne Kollaps). */
  collapseCause: string | null;
  highestTier: number;
  /** Stufe → Runde, in der erstmals eine Art dieser Stufe gelebt hat (0 = Startleben). */
  tierRound: Record<number, number>;
  human: boolean;
  /** Arten, die in dieser Partie je gelebt haben. */
  speciesSeen: string[];
  /** Art → wie oft ausgestorben. */
  extinctions: Record<string, number>;
  /** Zonen-Runden je Formart (nach der Natur-Phase). */
  formKinds: Record<string, number>;
  /** Zonen-Runden je Form. */
  forms: Record<string, number>;
  /** Höchste erreichte Zonenstufe je Zone. */
  maxLevel: Record<string, number>;
  /** Odem, der beim Rundenende übrig war (Summe). */
  unusedBreath: number;
  /** Odem, der an der Obergrenze verfallen ist (Summe). */
  wastedBreath: number;
  /** Runden, die mit vollem Odem (Obergrenze) begonnen haben. */
  roundsAtCap: number;
  /** Ausgegebener Odem (Summe). */
  spentBreath: number;
  cardPlays: Record<string, number>;
  /** Evolutions-Trichter: Art → Runden, in denen Stufe k (Index k−1) des Trichters erreicht war. */
  funnel: Record<string, number[]>;
  /** Eingetretene, abgewendete und angekündigte Ereignisse. */
  events: { occurred: number; cancelled: number };
  error: string | null;
}

/** Sicherung gegen Endlosschleifen: so viele Aktionen pro Runde höchstens. */
const MAX_ACTIONS_PER_ROUND = 200;

const add = (r: Record<string, number>, k: string, n = 1) => {
  r[k] = (r[k] ?? 0) + n;
};

/** Gruppe einer Harmonie-Quelle (extinction:frog → extinction, form:ideal bleibt). */
export const sourceGroup = (s: string) => (s.startsWith('extinction:') ? 'extinction' : s);

export interface RecordOptions {
  bot: BotName;
  seed: string;
  scenario: string;
  maxRounds: number;
  deck?: string[];
  book?: CreationBook;
}

/** Spielt eine Partie mit Protokoll. Liefert den Datensatz und den Endzustand (für das Schöpfungsbuch). */
export function recordGame(data: GameData, o: RecordOptions): { record: GameRecord; state: GameState | null } {
  const rec: GameRecord = {
    bot: o.bot,
    seed: o.seed,
    scenario: o.scenario,
    rounds: 0,
    collapsed: false,
    score: 0,
    harmony: [],
    harmonyParts: {},
    collapseCause: null,
    highestTier: 0,
    tierRound: {},
    human: false,
    speciesSeen: [],
    extinctions: {},
    formKinds: {},
    forms: {},
    maxLevel: {},
    unusedBreath: 0,
    wastedBreath: 0,
    roundsAtCap: 0,
    spentBreath: 0,
    cardPlays: {},
    events: { occurred: 0, cancelled: 0 },
    funnel: {},
    error: null,
  };
  const recent: Record<string, number>[] = [];
  const breathMax = paramsOf<{ max: number }>(data, 'breath').max;
  let state: GameState | null = null;
  try {
    const bot = createBot(o.bot, o.seed);
    state = newGame(data, { seed: o.seed, scenario: o.scenario, deck: o.deck, book: o.book });
    let actions = 0;
    while (state.phase === 'play' && state.round <= o.maxRounds) {
      const round = state.round;
      const action = bot.choose(data, state);
      if (action.type === 'endTurn') {
        rec.unusedBreath += state.breath;
        // Verfall an der Obergrenze: was der Zufluss über das Maximum hinaus gebracht hätte.
        rec.wastedBreath += Math.max(0, state.breath + expectedIncome(data, state) - breathMax);
      }
      const res = step(data, state, action);
      for (const e of res.events) {
        if (e.type === 'cardPlayed') {
          add(rec.cardPlays, e.card);
          rec.spentBreath += e.cost;
        } else if (e.type === 'harmonyChanged') {
          const parts: Record<string, number> = {};
          for (const p of e.parts) add(parts, sourceGroup(p.source), p.amount);
          for (const [k, n] of Object.entries(parts)) add(rec.harmonyParts, k, n);
          recent.push(parts);
          if (recent.length > 8) recent.shift();
          rec.harmony.push(e.to);
        } else if (e.type === 'eventOccurred') rec.events.occurred++;
        else if (e.type === 'eventCancelled') rec.events.cancelled++;
      }
      state = res.state;
      if (action.type === 'endTurn') {
        for (const z of state.zones) {
          add(rec.formKinds, data.forms.get(z.form)?.form.kind ?? 'normal');
          add(rec.forms, z.form);
          rec.maxLevel[z.id] = Math.max(rec.maxLevel[z.id] ?? 0, z.level);
        }
        if (state.phase === 'play' && state.breath >= breathMax) rec.roundsAtCap++;
        for (const [sp, stage] of Object.entries(evolutionFunnel(data, state))) {
          const f = (rec.funnel[sp] ??= FUNNEL.map(() => 0));
          for (let k = 0; k < stage; k++) f[k]!++;
        }
      }
      actions = state.round === round ? actions + 1 : 0;
      if (actions > MAX_ACTIONS_PER_ROUND)
        throw new Error(`mehr als ${MAX_ACTIONS_PER_ROUND} Aktionen in Runde ${round}`);
    }
    rec.rounds = state.phase === 'over' ? state.round : state.round - 1;
    rec.collapsed = state.phase === 'over';
    rec.score = state.score;
    rec.speciesSeen = Object.keys(state.species);
    for (const [sid, r] of Object.entries(state.species)) {
      const tier = data.species.get(sid)?.tier ?? 0;
      rec.highestTier = Math.max(rec.highestTier, tier);
      rec.tierRound[tier] = Math.min(rec.tierRound[tier] ?? Infinity, r.since);
      if (data.species.get(sid)?.human) rec.human = true;
    }
    for (const x of state.extinctions) add(rec.extinctions, x.species);
    if (rec.collapsed) {
      const sum: Record<string, number> = {};
      for (const p of recent) for (const [k, n] of Object.entries(p)) if (n < 0) add(sum, k, n);
      rec.collapseCause = Object.entries(sum).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
    }
  } catch (e) {
    rec.error = e instanceof Error ? e.message : String(e);
  }
  return { record: rec, state };
}

// ---------------------------------------------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------------------------------------------

/** Perzentil (0–1) einer Zahlenreihe, linear interpoliert; null bei leerer Reihe. */
export function percentile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export const median = (values: readonly number[]) => percentile(values, 0.5);
export const mean = (values: readonly number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export interface BotReport {
  bot: string;
  scenario: string;
  runs: number;
  errors: { seed: string; scenario: string; error: string }[];
  /** Partien, die das Rundenlimit erreicht haben. */
  survived: number;
  rounds: { median: number | null; p10: number | null; p90: number | null; mean: number | null };
  score: { median: number | null; p10: number | null; p90: number | null };
  /** Anteil der Partien je Kollapsgrund. */
  collapseCauses: Record<string, number>;
  /** Mittlerer Harmonie-Beitrag je Quelle und Runde. */
  harmonyPerRound: Record<string, number>;
  /** Anteil der Partien je höchster Stufe (1–7). */
  highestTier: Record<number, number>;
  /** Je Stufe: Anteil der Partien, die sie erreichen, und Median-Jahr des ersten Erreichens (unter diesen). */
  tiers: Record<number, { share: number; medianYear: number | null; p10Year: number | null; p90Year: number | null }>;
  /** Median-Jahr bis Stufe 6 über alle Partien (nicht erreicht = unendlich); null, wenn < 50 % sie erreichen. */
  tier6YearAll: number | null;
  humanShare: number;
  /** Art → Anteil der Partien, in denen sie mindestens einmal ausstirbt. */
  extinctionShare: Record<string, number>;
  /** Art → Anteil der Partien, in denen sie je lebt. */
  speciesShare: Record<string, number>;
  /** Anteil der Zonen-Runden je Formart. */
  formKinds: Record<string, number>;
  /** Die häufigsten Formen (Anteil der Zonen-Runden). */
  topForms: [string, number][];
  /** Mittlere höchste Zonenstufe je Zone. */
  maxLevel: Record<string, number>;
  breath: { unusedPerRound: number; wastedPerRound: number; capShare: number; spentPerRound: number };
  /** Karten nach Häufigkeit: Karte, Ausspielungen je Partie. */
  topCards: [string, number][];
  playsPerRound: number;
  eventsPerGame: { occurred: number; cancelled: number };
  /** Evolutions-Trichter: Art → Anteil der Runden mit Stufe ancestor/special/habitat/level/pressure erfüllt. */
  funnel: Record<string, Record<(typeof FUNNEL)[number], number>>;
  /** Verläufe je Jahr (Index 0 = Jahr 1). */
  byYear: {
    years: number[];
    alive: number[];
    harmonyP10: (number | null)[];
    harmonyMedian: (number | null)[];
    harmonyP90: (number | null)[];
    tier6: number[];
    tier5: number[];
    human: number[];
  };
}

const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

export function aggregate(data: GameData, bot: string, scenario: string, recs: readonly GameRecord[]): BotReport {
  const ok = recs.filter((r) => r.error === null);
  const n = ok.length;
  const totalRounds = ok.reduce((s, r) => s + r.rounds, 0);
  const rounds = ok.map((r) => r.rounds);
  const scores = ok.map((r) => r.score);
  const causes: Record<string, number> = {};
  for (const r of ok) if (r.collapseCause) add(causes, r.collapseCause);
  const parts: Record<string, number> = {};
  for (const r of ok) for (const [k, v] of Object.entries(r.harmonyParts)) add(parts, k, v);
  const highest: Record<number, number> = {};
  for (const r of ok) add(highest as Record<string, number>, String(r.highestTier));
  const tiers: BotReport['tiers'] = {};
  const maxTier = Math.max(...[...data.species.values()].map((s) => s.tier));
  for (let t = 1; t <= maxTier; t++) {
    const years = ok.filter((r) => r.tierRound[t] !== undefined).map((r) => yearAt(data, r.tierRound[t]!));
    tiers[t] = {
      share: share(years.length, n),
      medianYear: median(years),
      p10Year: percentile(years, 0.1),
      p90Year: percentile(years, 0.9),
    };
  }
  const t6all = ok.map((r) => (r.tierRound[6] !== undefined ? yearAt(data, r.tierRound[6]) : Infinity));
  const t6med = median(t6all);
  const ext: Record<string, number> = {};
  const lived: Record<string, number> = {};
  for (const r of ok) {
    for (const s of Object.keys(r.extinctions)) add(ext, s);
  }
  const kinds: Record<string, number> = {};
  const forms: Record<string, number> = {};
  const levels: Record<string, number> = {};
  const cards: Record<string, number> = {};
  for (const r of ok) {
    for (const [k, v] of Object.entries(r.formKinds)) add(kinds, k, v);
    for (const [k, v] of Object.entries(r.forms)) add(forms, k, v);
    for (const [k, v] of Object.entries(r.maxLevel)) add(levels, k, v);
    for (const [k, v] of Object.entries(r.cardPlays)) add(cards, k, v);
  }
  const zoneRounds = Object.values(kinds).reduce((a, b) => a + b, 0);
  const plays = Object.values(cards).reduce((a, b) => a + b, 0);
  for (const r of ok) for (const s of r.speciesSeen) add(lived, s);

  const maxYear = Math.max(1, ...ok.map((r) => yearAt(data, r.rounds)));
  const years = Array.from({ length: maxYear }, (_, i) => i + 1);
  const lastRoundOf = (y: number) => y * data.seasons.length - data.startSeason;
  const byYear: BotReport['byYear'] = {
    years,
    alive: [],
    harmonyP10: [],
    harmonyMedian: [],
    harmonyP90: [],
    tier6: [],
    tier5: [],
    human: [],
  };
  for (const y of years) {
    const last = lastRoundOf(y);
    // Läuft am Ende des Jahres noch: mehr Runden gespielt oder bis hierhin ohne Kollaps.
    const running = ok.filter((r) => r.rounds > last || (!r.collapsed && r.rounds >= last));
    byYear.alive.push(share(running.length, n));
    const hs = ok.filter((r) => r.harmony.length >= last).map((r) => r.harmony[last - 1]!);
    byYear.harmonyP10.push(round2(percentile(hs, 0.1)));
    byYear.harmonyMedian.push(round2(median(hs)));
    byYear.harmonyP90.push(round2(percentile(hs, 0.9)));
    const reached = (t: number) => ok.filter((r) => r.tierRound[t] !== undefined && r.tierRound[t] <= last).length;
    byYear.tier6.push(share(reached(6), n));
    byYear.tier5.push(share(reached(5), n));
    byYear.human.push(share(reached(7), n));
  }

  const funnelSum: Record<string, number[]> = {};
  for (const r of ok)
    for (const [sp, f] of Object.entries(r.funnel)) {
      const acc = (funnelSum[sp] ??= FUNNEL.map(() => 0));
      f.forEach((c, k) => (acc[k]! += c));
    }
  const funnel = Object.fromEntries(
    [...data.species.values()]
      .filter((sp) => sp.ancestor !== null)
      .map((sp) => [
        sp.id,
        Object.fromEntries(FUNNEL.map((st, k) => [st, round3(share(funnelSum[sp.id]?.[k] ?? 0, totalRounds))])),
      ]),
  ) as BotReport['funnel'];

  return {
    bot,
    scenario,
    runs: recs.length,
    errors: recs.filter((r) => r.error !== null).map((r) => ({ seed: r.seed, scenario: r.scenario, error: r.error! })),
    survived: ok.filter((r) => !r.collapsed).length,
    rounds: {
      median: median(rounds),
      p10: round2(percentile(rounds, 0.1)),
      p90: round2(percentile(rounds, 0.9)),
      mean: round2(mean(rounds)),
    },
    score: { median: median(scores), p10: round2(percentile(scores, 0.1)), p90: round2(percentile(scores, 0.9)) },
    collapseCauses: Object.fromEntries(Object.entries(causes).map(([k, v]) => [k, share(v, n)])),
    harmonyPerRound: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round2(share(v, totalRounds))!])),
    highestTier: Object.fromEntries(Object.entries(highest).map(([k, v]) => [Number(k), share(v, n)])),
    tiers,
    tier6YearAll: t6med === null || !Number.isFinite(t6med) ? null : t6med,
    humanShare: share(ok.filter((r) => r.human).length, n),
    extinctionShare: Object.fromEntries(Object.entries(ext).map(([k, v]) => [k, share(v, n)])),
    speciesShare: Object.fromEntries(Object.entries(lived).map(([k, v]) => [k, share(v, n)])),
    formKinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, share(v, zoneRounds)])),
    topForms: Object.entries(forms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => [k, round2(share(v, zoneRounds))!]),
    maxLevel: Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, round2(share(v, n))!])),
    breath: {
      unusedPerRound: round2(
        share(
          ok.reduce((s, r) => s + r.unusedBreath, 0),
          totalRounds,
        ),
      )!,
      wastedPerRound: round2(
        share(
          ok.reduce((s, r) => s + r.wastedBreath, 0),
          totalRounds,
        ),
      )!,
      capShare: round2(
        share(
          ok.reduce((s, r) => s + r.roundsAtCap, 0),
          totalRounds,
        ),
      )!,
      spentPerRound: round2(
        share(
          ok.reduce((s, r) => s + r.spentBreath, 0),
          totalRounds,
        ),
      )!,
    },
    topCards: Object.entries(cards)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => [k, round2(share(v, n))!]),
    playsPerRound: round2(share(plays, totalRounds))!,
    eventsPerGame: {
      occurred: round2(
        share(
          ok.reduce((s, r) => s + r.events.occurred, 0),
          n,
        ),
      )!,
      cancelled: round2(
        share(
          ok.reduce((s, r) => s + r.events.cancelled, 0),
          n,
        ),
      )!,
    },
    funnel,
    byYear,
  };
}
