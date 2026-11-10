/**
 * Bots für Absturz-Test und Balancing (Phase 6).
 *
 * - random: spielt zufällige legale Karten und beendet die Runde zufällig, sobald erlaubt.
 * - greedy: bewertet jeden legalen Zug per Vorschau (Formwechsel nach Harmonie-Gewicht, Störungen,
 *   Nähe zum Ruhewert, Kosten) und spielt den besten, solange er sich lohnt oder Kartenzwang herrscht.
 * - gardener, evolver, disruptor: Strategie-Bots mit Vorausschau der sichtbaren Natur-Phase (strategy.ts).
 */
import {
  canEndTurn,
  legalPlays,
  preview,
  rngOf,
  seedFrom,
  type Action,
  type GameData,
  type GameState,
  type Play,
} from '@being-god/core';
import { chooseByProfile, PROFILES, type StrategyName } from './strategy.ts';

export type BotName = 'random' | 'greedy' | StrategyName;
export const BOT_NAMES: readonly BotName[] = ['random', 'greedy', 'gardener', 'evolver', 'disruptor'];

export interface Bot {
  name: BotName;
  /** Nächste Aktion im aktuellen Zustand. */
  choose(data: GameData, state: GameState): Action;
}

export function createBot(name: BotName, seed: string | number = 1): Bot {
  if (name === 'random') return randomBot(seed);
  if (name === 'greedy') return greedyBot();
  const profile = PROFILES[name];
  return { name, choose: (data, state) => chooseByProfile(data, state, profile) };
}

const play = (p: Play): Action => ({ type: 'play', uid: p.uid, targets: p.targets });

function randomBot(seed: string | number): Bot {
  const rng = rngOf({ rng: seedFrom(`bot:${seed}`) });
  return {
    name: 'random',
    choose(data, state) {
      const plays = legalPlays(data, state);
      if (plays.length === 0 || (canEndTurn(data, state) && rng.float() < 0.5)) return { type: 'endTurn' };
      return play(rng.pick(plays));
    },
  };
}

/** Bewertung eines Zugs aus seiner Vorschau. */
export function scorePlay(data: GameData, state: GameState, p: Play): number {
  const pv = preview(data, state, p);
  const weights = data.harmony.perRound;
  const kindWeight = (form: string) => weights.formKind[data.forms.get(form)?.form.kind ?? 'normal'];
  let score = 0;
  for (const f of pv.formChanges) score += kindWeight(f.to) - kindWeight(f.from);
  const card = data.cards.get(p.card)!;
  for (const t of pv.triggers)
    if (card.triggers.find((x) => x.id === t.trigger)?.disturbance) score += weights.disturbance;
  for (const c of pv.changes) {
    const zone = state.zones.find((z) => z.id === c.zone)!;
    const rest = data.geographies.get(zone.geography)!.rest[c.stat] ?? c.from;
    score += 0.2 * (Math.abs(c.from - rest) - Math.abs(c.to - rest));
  }
  return score - 0.1 * pv.cost;
}

function greedyBot(): Bot {
  return {
    name: 'greedy',
    choose(data, state) {
      const plays = legalPlays(data, state);
      let best: Play | null = null;
      let bestScore = -Infinity;
      for (const p of plays) {
        const s = scorePlay(data, state, p);
        if (s > bestScore) [best, bestScore] = [p, s];
      }
      const mustPlay = !canEndTurn(data, state);
      if (best && (mustPlay || bestScore > 0)) return play(best);
      return { type: 'endTurn' };
    },
  };
}
