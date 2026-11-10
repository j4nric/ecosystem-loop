/**
 * Absturz-Test: Bots spielen Partien bis zum Kollaps oder Rundenlimit.
 * Keine Auswertung fürs Balancing – nur: läuft die Engine stabil?
 */
import { newGame, rngOf, seedFrom, step, type GameData } from '@being-god/core';
import { createBot, type BotName } from './bots.ts';

export interface RunOptions {
  bot: BotName;
  seed: string;
  scenario: string;
  maxRounds: number;
}

export interface RunResult {
  scenario: string;
  rounds: number;
  collapsed: boolean;
  error: string | null;
}

/** Sicherung gegen Endlosschleifen: so viele Aktionen pro Runde höchstens. */
const MAX_ACTIONS_PER_ROUND = 200;

export function runGame(data: GameData, o: RunOptions): RunResult {
  const result: RunResult = { scenario: o.scenario, rounds: 0, collapsed: false, error: null };
  try {
    const bot = createBot(o.bot, o.seed);
    let state = newGame(data, { seed: o.seed, scenario: o.scenario });
    let actions = 0;
    while (state.phase === 'play' && state.round <= o.maxRounds) {
      const round = state.round;
      state = step(data, state, bot.choose(data, state)).state;
      actions = state.round === round ? actions + 1 : 0;
      if (actions > MAX_ACTIONS_PER_ROUND)
        throw new Error(`mehr als ${MAX_ACTIONS_PER_ROUND} Aktionen in Runde ${round}`);
    }
    result.rounds = state.phase === 'over' ? state.round : state.round - 1;
    result.collapsed = state.phase === 'over';
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

export interface SimOptions {
  bot: BotName;
  runs: number;
  seed: string;
  /** Szenario-Id oder "random" (je Partie zufällig). */
  scenario: string;
  maxRounds: number;
}

export interface SimSummary {
  runs: number;
  collapsed: number;
  avgRounds: number;
  errors: { seed: string; scenario: string; error: string }[];
}

export function simulate(data: GameData, o: SimOptions): SimSummary {
  const rng = rngOf({ rng: seedFrom(`sim:${o.seed}`) });
  const scenarios = [...data.scenarios.keys()];
  const results: RunResult[] = [];
  const errors: SimSummary['errors'] = [];
  for (let i = 0; i < o.runs; i++) {
    const seed = `${o.seed}:${i}`;
    const scenario = o.scenario === 'random' ? rng.pick(scenarios) : o.scenario;
    const r = runGame(data, { bot: o.bot, seed, scenario, maxRounds: o.maxRounds });
    results.push(r);
    if (r.error !== null) errors.push({ seed, scenario, error: r.error });
  }
  const ok = results.filter((r) => r.error === null);
  return {
    runs: o.runs,
    collapsed: ok.filter((r) => r.collapsed).length,
    avgRounds: ok.length ? ok.reduce((s, r) => s + r.rounds, 0) / ok.length : 0,
    errors,
  };
}
