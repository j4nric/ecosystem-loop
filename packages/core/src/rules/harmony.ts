/** Harmonie 0–100: Beiträge der Zonen pro Runde, Kollaps bei 0 (Konzept 7). */
import { z } from 'zod';
import type { GameData } from '../schema/index.ts';
import type { GameEvent, GameState } from '../state.ts';
import { clamp, formKindOf, livingSpecies } from '../world.ts';
import { defineRule } from './module.ts';

export const HarmonyParams = z.strictObject({});

type Part = Extract<GameEvent, { type: 'harmonyChanged' }>['parts'][number];

/** Einzelbeiträge dieser Runde (ohne Aussterben/Hunger/Mensch – die kommen mit Phase 2). */
export function harmonyParts(data: GameData, state: GameState): Part[] {
  const w = data.harmony.perRound;
  const parts: Part[] = [];
  for (const zone of state.zones) {
    const kind = formKindOf(data, zone.form);
    if (w.formKind[kind] !== 0) parts.push({ source: `form:${kind}`, zone: zone.id, amount: w.formKind[kind] });
    // AUSLEGUNG: Konzept 8 nennt für gezielte Störungen einen „Harmonie-Einbruch“; Kap. 7 hat keine Zahl.
    // Daher ein eigener Beitrag je gestörter Zone (Platzhalter in harmony.yaml).
    if (zone.lastDisturbance === state.round && w.disturbance !== 0)
      parts.push({ source: 'disturbance', zone: zone.id, amount: w.disturbance });
  }
  const species = livingSpecies(state);
  if (species > 0 && w.perSpecies !== 0) parts.push({ source: 'species', zone: null, amount: species * w.perSpecies });
  return parts;
}

export const harmony = defineRule({
  id: 'harmony',
  params: HarmonyParams,
  run({ data, state, emit }) {
    const parts = harmonyParts(data, state);
    const from = state.harmony;
    const delta = parts.reduce((s, p) => s + p.amount, 0);
    const to = clamp(from + delta, 0, data.harmony.max);
    state.harmony = to;
    state.harmonyTrend = to - from;
    emit({ type: 'harmonyChanged', from, to, parts });
    if (to <= data.harmony.collapseAt) {
      state.phase = 'over';
      emit({ type: 'collapsed', round: state.round });
    }
  },
});
