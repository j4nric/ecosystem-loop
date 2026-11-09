/**
 * Kampagnen-Simulation: mehrere Expeditionen hintereinander mit wachsendem Notizbuch.
 * Beantwortet z. B. „Ist Stufe 2 in Expedition 1 erreichbar, Stufe 4 in Expedition 3–4?“
 */
import {
  createExpedition,
  report,
  emptyNotebook,
  recordExpedition,
  validateDeck,
  type Notebook,
  nextInt,
  seedFrom,
  type RngHolder,
  type GameData,
  type EndReason,
} from '@being-god/core';
import { createBot, type BotName } from './bots.ts';

export interface ExpeditionResult {
  index: number;
  scenario: string;
  deck: string[];
  turns: number;
  endReason: EndReason;
  points: number;
  /** Höchste Stufe, die beim Abschluss dokumentiert wurde. */
  highestTier: number;
  /** Höchste Stufe, die während der Expedition irgendwann eingezogen war. */
  highestTierSeen: number;
  species: string[];
  newDiscoveries: string[];
  cardsPlayed: number;
}

export interface CampaignOptions {
  bot: BotName;
  expeditions: number;
  seed: string | number;
  /** Szenario-Id oder "random". */
  scenario: string;
  maxTurnsSafety?: number;
}

export function runCampaign(data: GameData, opts: CampaignOptions): { results: ExpeditionResult[]; notebook: Notebook } {
  const nb = emptyNotebook();
  const bot = createBot(opts.bot, opts.seed);
  const pickRng: RngHolder = { rng: seedFrom(`scenario:${opts.seed}`) };
  const scenarioIds = [...data.scenarios.keys()];
  const results: ExpeditionResult[] = [];
  const safety = opts.maxTurnsSafety ?? 200;

  for (let i = 1; i <= opts.expeditions; i++) {
    const scenario = opts.scenario === 'random' ? scenarioIds[nextInt(pickRng, scenarioIds.length)]! : opts.scenario;
    const deck = bot.buildDeck(data, nb);
    const problems = validateDeck(data, nb, deck);
    if (problems.length) throw new Error(`Bot-Deck ungültig: ${problems.join(' ')}`);

    const state = createExpedition(data, { deck, scenario, seed: `${opts.seed}:${i}` });
    let guard = 0;
    while (state.phase === 'play') {
      if (++guard > safety) throw new Error(`Expedition endet nicht (>${safety} Züge)`);
      bot.takeTurn(data, state);
    }
    const r = report(data, state);
    const tierOf = (a: string) => data.animals.get(a)!.tier;
    results.push({
      index: i,
      scenario,
      deck,
      turns: state.turn,
      endReason: state.endReason!,
      points: r.points,
      highestTier: r.highestTier,
      highestTierSeen: Math.max(0, ...state.arrivedSpecies.map(tierOf)),
      species: r.species,
      newDiscoveries: recordExpedition(data, nb, state),
      cardsPlayed: Object.values(state.cardPlays).reduce((a, b) => a + b, 0),
    });
  }
  return { results, notebook: nb };
}

export interface ExpeditionStats {
  index: number;
  runs: number;
  avgTurns: number;
  avgPoints: number;
  avgCardsPlayed: number;
  /** Anteil der Läufe, deren Abschluss mind. Stufe k dokumentiert (k = 1..4). */
  tierAtEnd: number[];
  /** Anteil der Läufe, in denen mind. Stufe k irgendwann eingezogen war. */
  tierSeen: number[];
  endReasons: Partial<Record<EndReason, number>>;
}

export interface SimulationSummary {
  options: CampaignOptions & { runs: number };
  perExpedition: ExpeditionStats[];
  /** Tier → Anteil der Kampagnen, die es bis Expedition k im Notizbuch haben (Index k-1). */
  discoveredBy: Record<string, number[]>;
}

export function simulate(data: GameData, opts: CampaignOptions & { runs: number }): SimulationSummary {
  const campaigns = Array.from({ length: opts.runs }, (_, r) =>
    runCampaign(data, { ...opts, seed: `${opts.seed}#${r}` }),
  );
  const maxTier = Math.max(...[...data.animals.values()].map((a) => a.tier));
  const share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const perExpedition: ExpeditionStats[] = [];
  for (let i = 0; i < opts.expeditions; i++) {
    const rs = campaigns.map((c) => c.results[i]!);
    const endReasons: Partial<Record<EndReason, number>> = {};
    for (const r of rs) endReasons[r.endReason] = (endReasons[r.endReason] ?? 0) + 1 / rs.length;
    perExpedition.push({
      index: i + 1,
      runs: rs.length,
      avgTurns: avg(rs.map((r) => r.turns)),
      avgPoints: avg(rs.map((r) => r.points)),
      avgCardsPlayed: avg(rs.map((r) => r.cardsPlayed)),
      tierAtEnd: Array.from({ length: maxTier }, (_, k) => share(rs.map((r) => r.highestTier >= k + 1))),
      tierSeen: Array.from({ length: maxTier }, (_, k) => share(rs.map((r) => r.highestTierSeen >= k + 1))),
      endReasons,
    });
  }

  const discoveredBy: Record<string, number[]> = {};
  for (const a of data.animals.keys())
    discoveredBy[a] = Array.from({ length: opts.expeditions }, (_, k) =>
      share(campaigns.map((c) => (c.notebook.entries[a]?.firstExpedition ?? Infinity) <= k + 1)),
    );

  return { options: opts, perExpedition, discoveredBy };
}
