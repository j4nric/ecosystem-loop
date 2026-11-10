/**
 * Zufalls-Bot für den Absturz-Test (keine Messung, Logik vor Balancing). Spielt nur über die Fassade.
 * Sein Zufall ist ein eigener Seed-Strom, damit Läufe reproduzierbar bleiben und das Spiel nicht beeinflussen.
 * Merkmale: nimmt bevorzugt eines, das zur Reife fehlt, sonst ein zufälliges, solange es der Reife noch hilft (sonst
 * spart er es für die nächste Stufe auf); springt, sobald die Herde reif ist.
 */
import type { HerdeEvent, HerdeState, Outcome } from './api.ts';
import { legalPlays, newGame, step, evolutionOf } from './game.ts';
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
  /** durchlaufene Stufen (Start zuerst) */
  stages: string[];
  state: HerdeState;
}

export function playRandomGame(data: HerdeData, options: BotOptions): BotResult {
  const bot = { rng: seedFrom(`bot:${options.seed}`) };
  const playChance = options.playChance ?? 0.5;
  const maxMonths = options.maxMonths ?? 600;
  let state = newGame(data, { seed: options.seed, island: options.island });
  let plays = 0;
  let events = 0;
  const stages = [state.herd.stage];
  const apply = (r: { state: HerdeState; events: HerdeEvent[] }) => {
    state = r.state;
    events += r.events.length;
    if (options.check) {
      const c = validateState(data, state);
      if (!c.ok) throw new Error(`Ungültiger Zustand nach Monat ${state.month}: ${c.reason}`);
    }
  };
  while (!state.over && state.month < maxMonths) {
    const evo = evolutionOf(data, state);
    if (evo.offer.length > 0) {
      const missing = evo.missing;
      const wanted = evo.offer.filter((id) => missing?.oneOf?.includes(id));
      // Ein beliebiges Merkmal hilft der Reife nur, solange außer dem verlangten noch Plätze fehlen; sonst spart der
      // Bot es für die nächste Stufe auf (dort zählen nur neu gewählte Merkmale). Auf der letzten Stufe nimmt er alles.
      const free = missing === null || missing.traits > (missing.oneOf ? 1 : 0);
      if (wanted.length > 0) apply(step(data, state, { type: 'pickTrait', trait: pick(bot, wanted) }));
      else if (free && !evo.mature) apply(step(data, state, { type: 'pickTrait', trait: pick(bot, evo.offer) }));
    }
    if (evolutionOf(data, state).mature) {
      apply(step(data, state, { type: 'evolve' }));
      stages.push(state.herd.stage);
    }
    while (nextFloat(bot) < playChance) {
      const moves = legalPlays(data, state);
      if (moves.length === 0) break;
      apply(step(data, state, pick(bot, moves)));
      plays++;
    }
    apply(step(data, state, { type: 'advance' }));
  }
  return { outcome: state.over, months: state.month, survivors: state.herd.size, plays, events, stages, state };
}
