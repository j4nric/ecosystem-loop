/**
 * Zufalls-Bot für den Absturz-Test (keine Messung, Logik vor Balancing). Spielt nur über die Fassade.
 * Sein Zufall ist ein eigener Seed-Strom, damit Läufe reproduzierbar bleiben und das Spiel nicht beeinflussen.
 */
import type { HerdeEvent, HerdeState, Outcome } from './api.ts';
import { legalPlays, newGame, step } from './game.ts';
import { nextFloat, pick, seedFrom } from './rng.ts';
import type { HerdeData } from './schema.ts';
import { validateState } from './validate.ts';

export interface BotOptions {
  seed: number | string;
  island?: string;
  /** Chance, in einem Monat eine (weitere) Karte zu spielen */
  playChance?: number;
  /** Abbruch nach so vielen Monaten (Schutz gegen Endlosschleifen) */
  maxMonths?: number;
  /** jeden Zustand mit validateState prüfen */
  check?: boolean;
}

export interface BotResult {
  outcome: Outcome | null;
  months: number;
  survivors: number;
  plays: number;
  events: number;
  state: HerdeState;
}

export function playRandomGame(data: HerdeData, options: BotOptions): BotResult {
  const bot = { rng: seedFrom(`bot:${options.seed}`) };
  const playChance = options.playChance ?? 0.5;
  const maxMonths = options.maxMonths ?? 600;
  let state = newGame(data, { seed: options.seed, island: options.island });
  let plays = 0;
  let events = 0;
  const apply = (r: { state: HerdeState; events: HerdeEvent[] }) => {
    state = r.state;
    events += r.events.length;
    if (options.check) {
      const c = validateState(data, state);
      if (!c.ok) throw new Error(`Ungültiger Zustand nach Monat ${state.month}: ${c.reason}`);
    }
  };
  while (!state.over && state.month < maxMonths) {
    while (nextFloat(bot) < playChance) {
      const moves = legalPlays(data, state);
      if (moves.length === 0) break;
      apply(step(data, state, pick(bot, moves)));
      plays++;
    }
    apply(step(data, state, { type: 'advance' }));
  }
  return { outcome: state.over, months: state.month, survivors: state.herd.size, plays, events, state };
}
