/**
 * Auswertung der Bedingungssprache (Steckbriefe, Schwellen, Zonenwechsel, Slot-Filter).
 */
import type { Condition, GameData } from './schema.ts';
import type { ExpeditionState, ZoneState } from './state.ts';

export interface ConditionContext {
  data: GameData;
  state: ExpeditionState;
  zone: ZoneState;
}

export function getZone(state: ExpeditionState, id: string): ZoneState {
  const z = state.zones.find((z) => z.id === id);
  if (!z) throw new Error(`Unbekannte Zone: ${id}`);
  return z;
}

export function hasAnimal(zone: ZoneState, animal: string): boolean {
  return zone.animals.some((a) => a.id === animal);
}

/** Züge seit der letzten Störung in der Zone oder einer Nachbarzone. */
export function calmTurns(state: ExpeditionState, zone: ZoneState): number {
  let last = zone.lastDisturbanceTurn;
  for (const n of zone.neighbors) last = Math.max(last, getZone(state, n).lastDisturbanceTurn);
  return state.turn - last;
}

export function holds(c: Condition, ctx: ConditionContext): boolean {
  const { zone, state } = ctx;
  if ('stat' in c) {
    const v = zone.values[c.stat];
    if (c.gte !== undefined && !(v >= c.gte)) return false;
    if (c.lte !== undefined && !(v <= c.lte)) return false;
    if (c.eq !== undefined && v !== c.eq) return false;
    return true;
  }
  if ('animal' in c) return hasAnimal(zone, c.animal);
  if ('noAnimal' in c) return !hasAnimal(zone, c.noAnimal);
  if ('tag' in c) return zone.tags.includes(c.tag);
  if ('noTag' in c) return !zone.tags.includes(c.noTag);
  if ('zoneType' in c) return zone.type === c.zoneType;
  if ('anyNeighbor' in c)
    return zone.neighbors.some((n) => holdsAll(c.anyNeighbor, { ...ctx, zone: getZone(state, n) }));
  if ('cardPlayed' in c) return (state.cardPlays[c.cardPlayed] ?? 0) >= c.gte;
  if ('calmTurns' in c) return calmTurns(state, zone) >= c.calmTurns;
  if ('hasAnimals' in c) return zone.animals.length > 0 === c.hasAnimals;
  if ('not' in c) return !holdsAll(c.not, ctx);
  if ('any' in c) return c.any.some((sub) => holds(sub, ctx));
  const never: never = c;
  throw new Error(`Unbekannte Bedingung: ${JSON.stringify(never)}`);
}

export function holdsAll(cs: readonly Condition[], ctx: ConditionContext): boolean {
  return cs.every((c) => holds(c, ctx));
}

/** Für Anzeige/Analyse: welche Bedingungen eines Steckbriefs sind (nicht) erfüllt. */
export function evaluateEach(cs: readonly Condition[], ctx: ConditionContext): { condition: Condition; ok: boolean }[] {
  return cs.map((condition) => ({ condition, ok: holds(condition, ctx) }));
}
