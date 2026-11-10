/** Jahreszeiten wirken auf die Werte (Konzept 9, Natur-Schritt 1). */
import { z } from 'zod';
import { applyEffect } from '../cards/effects.ts';
import { holdsAll } from '../conditions.ts';
import { seasonOf } from '../world.ts';
import { defineRule } from './module.ts';

export const SeasonParams = z.strictObject({});

export const season = defineRule({
  id: 'season',
  params: SeasonParams,
  run({ data, state, emit }) {
    const s = seasonOf(data, state.round);
    emit({ type: 'seasonApplied', season: s.id });
    for (const rule of s.rules) {
      // Erst alle betroffenen Zonen bestimmen, dann wirken lassen (reihenfolgeunabhängig).
      const zones = state.zones.filter(
        (zone) =>
          (rule.geographies.length === 0 || rule.geographies.includes(zone.geography)) &&
          holdsAll(rule.when, { data, state, zone }),
      );
      for (const zone of zones)
        for (const e of rule.effects)
          applyEffect({ data, state, emit, bind: { self: zone.id }, cause: `season:${s.id}` }, e);
    }
  },
});
