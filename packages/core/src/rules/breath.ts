/** Odem: Zufluss pro Runde = base + ⌊Harmonie / harmonyStep⌋ (+ Bonus bei vielen Arten), Obergrenze (Konzept 6.1). */
import { z } from 'zod';
import type { GameData } from '../schema/index.ts';
import type { GameState } from '../state.ts';
import { livingSpecies } from '../world.ts';
import { defineRule, paramsOf } from './module.ts';

export const BreathParams = z.strictObject({
  /** Odem zu Beginn der Partie. */
  start: z.number().int().nonnegative(),
  base: z.number().int(),
  harmonyStep: z.number().positive(),
  speciesBonus: z.number().int(),
  speciesBonusFrom: z.number().int().positive(),
  max: z.number().int().positive(),
});
export type BreathParams = z.infer<typeof BreathParams>;

const spec = { id: 'breath', params: BreathParams };

export function breathParams(data: GameData): BreathParams {
  return paramsOf(data, spec);
}

export function breathMax(data: GameData): number {
  return breathParams(data).max;
}

export function breathIncome(data: GameData, state: GameState): number {
  const p = breathParams(data);
  const bonus = livingSpecies(state) >= p.speciesBonusFrom ? p.speciesBonus : 0;
  return p.base + Math.floor(state.harmony / p.harmonyStep) + bonus;
}

export const breath = defineRule({
  ...spec,
  run({ data, state, params, emit }) {
    const from = state.breath;
    const to = Math.min(params.max, from + breathIncome(data, state));
    if (to !== from) {
      state.breath = to;
      emit({ type: 'breathChanged', from, to, cause: 'income' });
    }
  },
});
