/** Selbstheilung: Alle `interval` Runden driftet jeder Wert um `step` zum Ruhewert (Konzept 4.1). */
import { z } from 'zod';
import { towardRest } from '../cards/effects.ts';
import { defineRule } from './module.ts';

export const HealingParams = z.strictObject({
  interval: z.number().int().positive(),
  step: z.number().int().positive(),
});

export const healing = defineRule({
  id: 'healing',
  params: HealingParams,
  run({ data, state, params, emit }) {
    if (state.round % params.interval !== 0) return;
    for (const zone of state.zones)
      for (const stat of Object.keys(zone.stats)) towardRest(data, zone, stat, params.step, emit, 'healing');
  },
});
