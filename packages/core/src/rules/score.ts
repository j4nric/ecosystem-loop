/** Wertung (Konzept 10): Jede Runde bringt die Summe der Stufen aller lebenden Arten, mit Menschen mal humanFactor. */
import { z } from 'zod';
import { livingSpeciesDefs } from '../population.ts';
import type { GameData } from '../schema/index.ts';
import type { GameState } from '../state.ts';
import { defineRule } from './module.ts';

export const ScoreParams = z.strictObject({
  /** Faktor, solange eine Menschen-Art lebt. */
  humanFactor: z.number().int().positive(),
});

/** Punkte, die die Welt in ihrem jetzigen Zustand für eine Runde bringt. */
export function roundPoints(
  data: GameData,
  state: GameState,
  humanFactor: number,
): { points: number; doubled: boolean } {
  const living = livingSpeciesDefs(data, state);
  const doubled = living.some((s) => s.human);
  const sum = living.reduce((n, s) => n + s.tier, 0);
  return { points: doubled ? sum * humanFactor : sum, doubled };
}

export const score = defineRule({
  id: 'score',
  params: ScoreParams,
  run({ data, state, params, emit }) {
    const { points, doubled } = roundPoints(data, state, params.humanFactor);
    state.score += points;
    emit({ type: 'scored', points, total: state.score, doubled });
  },
});
