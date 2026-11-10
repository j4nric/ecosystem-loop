/** Zonenstufe 1–5: Aufstieg nach stabilen Runden, Abstieg bei Verödung, Störung oder Formwechsel (Konzept 4.4). */
import { z } from 'zod';
import type { GameData } from '../schema/index.ts';
import type { LevelReason, ZoneState } from '../state.ts';
import { formKindOf, speciesIn } from '../world.ts';
import { defineRule, paramsOf } from './module.ts';

export const LevelsParams = z.strictObject({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
  /** Runden am Stück in derselben, nicht verödeten Form bis zum Aufstieg. */
  riseAfter: z.number().int().positive(),
  /** Ab dieser Stufe nur in der Idealform erreichbar. */
  idealFrom: z.number().int().positive(),
  species: z.strictObject({
    // AUSLEGUNG: Solange es keine Arten gibt (Phase 1), ist die Arten-Bedingung abgeschaltet.
    enabled: z.boolean(),
    /** „genügend Arten“ für jeden Aufstieg (Zahl nicht im Konzept, Platzhalter). */
    forRise: z.number().int().nonnegative(),
    /** Arten für die höchste Stufe. */
    forTop: z.number().int().nonnegative(),
  }),
});
export type LevelsParams = z.infer<typeof LevelsParams>;

const spec = { id: 'levels', params: LevelsParams };

/** Kann die Zone in ihrer aktuellen Form (und mit ihren Arten) die nächste Stufe erreichen? */
export function canRise(data: GameData, zone: ZoneState): boolean {
  const p = paramsOf(data, spec);
  const next = zone.level + 1;
  if (next > p.max) return false;
  if (next >= p.idealFrom && formKindOf(data, zone.form) !== 'ideal') return false;
  if (p.species.enabled) {
    const need = next >= p.max ? p.species.forTop : p.species.forRise;
    if (speciesIn(zone) < need) return false;
  }
  return true;
}

/** Fortschritt zur nächsten Stufe (0–1); 0, wenn die nächste Stufe in dieser Form nicht erreichbar ist. */
export function levelProgress(data: GameData, zone: ZoneState): number {
  if (!canRise(data, zone)) return 0;
  return Math.min(1, zone.levelProgress / paramsOf(data, spec).riseAfter);
}

export const levels = defineRule({
  ...spec,
  run({ data, state, params, emit }) {
    for (const zone of state.zones) {
      const kind = formKindOf(data, zone.form);
      // AUSLEGUNG: Pro Runde fällt die Stufe höchstens um 1, auch wenn mehrere Gründe zusammenkommen.
      const fall: LevelReason | null =
        zone.lastDisturbance === state.round
          ? 'disturbance'
          : kind === 'degraded'
            ? 'degraded'
            : zone.formSince === state.round
              ? 'formChanged'
              : null;
      if (fall) {
        // AUSLEGUNG: Die Runde des Abstiegs zählt nicht zur Serie; die 3 Runden beginnen danach neu.
        zone.levelProgress = 0;
        if (zone.level > params.min) {
          emit({ type: 'levelChanged', zone: zone.id, from: zone.level, to: zone.level - 1, reason: fall });
          zone.level--;
        }
        continue;
      }
      zone.levelProgress = Math.min(params.riseAfter, zone.levelProgress + 1);
      if (zone.levelProgress >= params.riseAfter && canRise(data, zone)) {
        emit({ type: 'levelChanged', zone: zone.id, from: zone.level, to: zone.level + 1, reason: 'rise' });
        zone.level++;
        zone.levelProgress = 0;
      }
    }
  },
});
