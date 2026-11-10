/**
 * Zufalls-Bot für den Absturz-Test (keine Messung, Logik vor Balancing). Spielt nur über die Fassade.
 * Sein Zufall ist ein eigener Seed-Strom, damit Läufe reproduzierbar bleiben und das Spiel nicht beeinflussen.
 * Merkmale: nimmt bevorzugt eines, das zur Reife fehlt, sonst ein zufälliges, solange es der Reife noch hilft (sonst
 * spart er es für die nächste Stufe auf); springt, sobald die Herde reif ist. Gründet ein Lager, sobald es einen
 * gültigen Platz gibt. Fehlt zur Reife ein Merkmal aus einer Feuer-Erfahrung (`burnt`), legt er Feuer nahe der Herde.
 */
import type { HerdeEvent, HerdeState, Outcome } from './api.ts';
import { campSites } from './camp.ts';
import { getCard } from './cards.ts';
import { legalPlays, newGame, step, evolutionOf } from './game.ts';
import { nextFloat, pick, seedFrom } from './rng.ts';
import type { HerdeData } from './schema.ts';
import { validateState } from './validate.ts';
import { cheb, stageOf } from './world.ts';

export interface BotOptions {
  seed: number | string;
  island?: string;
  /** Chance, in einem Monat eine (weitere) Karte zu spielen */
  playChance?: number;
  /** Abbruch nach so vielen Monaten (Schutz gegen Endlosschleifen) */
  maxMonths?: number;
  /** jeden Zustand mit validateState prüfen */
  check?: boolean;
  /** wird nach jedem Schritt mit Zustand und Ereignissen aufgerufen (Fehlersuche) */
  onStep?: (state: HerdeState, events: readonly HerdeEvent[]) => void;
}

export interface BotResult {
  outcome: Outcome | null;
  months: number;
  survivors: number;
  plays: number;
  events: number;
  /** durchlaufene Stufen (Start zuerst) */
  stages: string[];
  /** ein Lager gegründet */
  camp: boolean;
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
    options.onStep?.(state, r.events);
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
    const sites = campSites(data, state);
    if (sites.length > 0) {
      const site = pick(bot, sites);
      apply(step(data, state, { type: 'settle', x: site.x, y: site.y }));
    }
    // Feuer als Werkzeug: Braucht die Reife ein Merkmal aus Feuer ohne Verlust, Feuer nahe der Herde legen.
    const wantsFire = (evolutionOf(data, state).missing?.oneOf ?? []).some((id) => {
      const from = data.traits.get(id)?.from;
      return from !== undefined && data.experiences.get(from)?.when.type === 'burnt';
    });
    if (wantsFire) {
      const reach = stageOf(data, state).reach;
      const fire = legalPlays(data, state).find(
        (a) =>
          a.type === 'play' &&
          getCard(data, state.hand[a.hand]!).effect.type === 'ignite' &&
          a.x !== undefined &&
          a.y !== undefined &&
          cheb({ x: a.x, y: a.y }, state.herd) <= reach,
      );
      if (fire) {
        apply(step(data, state, fire));
        plays++;
      }
    }
    while (nextFloat(bot) < playChance) {
      const moves = legalPlays(data, state);
      if (moves.length === 0) break;
      apply(step(data, state, pick(bot, moves)));
      plays++;
    }
    apply(step(data, state, { type: 'advance' }));
  }
  return {
    outcome: state.over,
    months: state.month,
    survivors: state.herd.size,
    plays,
    events,
    stages,
    camp: state.camp !== null,
    state,
  };
}
