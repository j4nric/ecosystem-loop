/** Kopplungen zwischen Nachbarzonen: Schneeschmelze, Süßwasser, Waldklima, Hochwasser (Konzept 4.3). */
import { z } from 'zod';
import { applyEffect } from '../cards/effects.ts';
import { holdsAll } from '../conditions.ts';
import { getZone, seasonOf } from '../world.ts';
import { defineRule } from './module.ts';

export const CouplingsParams = z.strictObject({});

export const couplings = defineRule({
  id: 'couplings',
  params: CouplingsParams,
  run({ data, state, emit }) {
    const current = seasonOf(data, state.round).id;
    for (const c of data.couplings) {
      if (c.seasons.length > 0 && !c.seasons.includes(current)) continue;
      // Alle Paare (Quelle → Ziel) zuerst bestimmen, dann wirken lassen.
      const pairs: [string, string][] = [];
      for (const src of state.zones) {
        if (src.geography !== c.from.geography || !holdsAll(c.from.when, { data, state, zone: src })) continue;
        for (const n of src.neighbors) {
          const target = getZone(state, n);
          if (c.to.geography !== undefined && target.geography !== c.to.geography) continue;
          if (holdsAll(c.to.when, { data, state, zone: target })) pairs.push([src.id, target.id]);
        }
      }
      for (const [from, to] of pairs) {
        emit({ type: 'couplingApplied', coupling: c.id, from, to });
        const ctx = { data, state, emit, bind: { self: to, source: from }, cause: `coupling:${c.id}` };
        for (const e of c.effects) applyEffect(ctx, e);
      }
    }
  },
});
