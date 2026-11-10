/** Auswertung der Bedingungssprache (Formen, Schwellen, Slot-Filter, Jahreszeiten, Kopplungen). */
import type { Condition, GameData } from './schema/index.ts';
import type { GameState, ZoneState } from './state.ts';
import { formKindOf, getZone, seasonOf } from './world.ts';

export interface ConditionContext {
  data: GameData;
  state: GameState;
  zone: ZoneState;
}

/** Prüft eine stat-Bedingung gegen einen Wert (auch für Vorschau ohne Zustand nutzbar). */
export function statHolds(c: { gte?: number; lte?: number; eq?: number }, v: number | undefined): boolean {
  // AUSLEGUNG: Ein Wert, den die Geografie nicht hat, erfüllt keine stat-Bedingung.
  if (v === undefined) return false;
  if (c.gte !== undefined && !(v >= c.gte)) return false;
  if (c.lte !== undefined && !(v <= c.lte)) return false;
  if (c.eq !== undefined && v !== c.eq) return false;
  return true;
}

export function holds(c: Condition, ctx: ConditionContext): boolean {
  const { zone, state, data } = ctx;
  if ('stat' in c) return statHolds(c, zone.stats[c.stat]);
  if ('hasStat' in c) return c.hasStat in zone.stats;
  if ('geography' in c) return zone.geography === c.geography;
  if ('form' in c) return zone.form === c.form;
  if ('formKind' in c) return formKindOf(data, zone.form) === c.formKind;
  if ('season' in c) return seasonOf(data, state.round).id === c.season;
  if ('disturbedWithin' in c)
    return zone.lastDisturbance !== null && state.round - zone.lastDisturbance < c.disturbedWithin;
  if ('population' in c) return statHolds(c, zone.populations[c.population] ?? 0);
  if ('minLevel' in c) return zone.level >= c.minLevel;
  if ('anyNeighbor' in c)
    return zone.neighbors.some((n) => holdsAll(c.anyNeighbor, { ...ctx, zone: getZone(state, n) }));
  if ('not' in c) return !holdsAll(c.not, ctx);
  if ('any' in c) return c.any.some((sub) => holds(sub, ctx));
  const never: never = c;
  throw new Error(`Unbekannte Bedingung: ${JSON.stringify(never)}`);
}

export function holdsAll(cs: readonly Condition[], ctx: ConditionContext): boolean {
  return cs.every((c) => holds(c, ctx));
}
