/**
 * Evolution (Konzept 5.2, 5.3): Höhere Arten entstehen aus ihrem Vorfahren, wenn in einer Zone
 * Bestand, Form, Zonenstufe, Sonderbedingungen und ab einer Stufe Selektionsdruck einige Runden lang passen.
 */
import { z } from 'zod';
import { holdsAll } from '../conditions.ts';
import { addGifts, lifeParams, populationOf, setPopulation } from '../population.ts';
import { Conditions, type GameData, type SpeciesDef } from '../schema/index.ts';
import type { GameState, ZoneState } from '../state.ts';
import { getZone } from '../world.ts';
import { defineRule, paramsOf } from './module.ts';

export const EvolutionParams = z.strictObject({
  /** Mindestbestand des Vorfahren in der Zone. */
  minAncestor: z.number().int().positive(),
  /** Runden in Folge, die alle Bedingungen erfüllt sein müssen. */
  rounds: z.number().int().positive(),
  /** So viele Tiere wechseln zur neuen Art. */
  amount: z.number().int().positive(),
  /** Zonenstufe ≥ Stufe der Art − levelGap (Konzept 4.4). */
  levelGap: z.number().int().nonnegative(),
  /** Selektionsdruck: ab Stufe fromTier müssen zusätzlich diese Bedingungen an die Zone gelten. */
  pressure: z.strictObject({ fromTier: z.number().int().positive(), when: Conditions }),
  /** Gaben des Startlebens kommen zu Spielbeginn ins Deck. */
  startGifts: z.boolean(),
});
export type EvolutionParams = z.infer<typeof EvolutionParams>;

const spec = { id: 'evolution', params: EvolutionParams };

export function evolutionParams(data: GameData): EvolutionParams {
  return paramsOf(data, spec);
}

/**
 * Lebensraum für die neue Art: die Zone selbst oder eine passende Nachbarzone mit Platz.
 * Die Zonenstufe gilt für die Zielzone (Konzept 4.4: „kann nur in einer Zone mit Stufe ≥ n − 2 entstehen“).
 */
function settleZone(
  data: GameData,
  state: GameState,
  zone: ZoneState,
  sp: SpeciesDef,
  p: EvolutionParams,
): ZoneState | null {
  const max = lifeParams(data).max;
  const fits = (z: ZoneState) =>
    sp.habitat.includes(z.form) && populationOf(z, sp.id) < max && z.level >= sp.tier - p.levelGap;
  if (fits(zone)) return zone;
  // AUSLEGUNG: Passt die Form der Ursprungszone nicht (z. B. Frosch → Echse, Primat → Mensch), entsteht die
  // neue Art in einer passenden Nachbarzone („Landgang“); bei mehreren die mit dem kleinsten Bestand.
  let best: ZoneState | null = null;
  for (const n of zone.neighbors) {
    const t = getZone(state, n);
    if (fits(t) && (!best || populationOf(t, sp.id) < populationOf(best, sp.id))) best = t;
  }
  return best;
}

/** Zielzone, wenn in `zone` alle Evolutionsbedingungen für `sp` erfüllt sind, sonst null. */
export function evolutionTarget(
  data: GameData,
  state: GameState,
  zone: ZoneState,
  sp: SpeciesDef,
  p: EvolutionParams = evolutionParams(data),
): ZoneState | null {
  if (sp.ancestor === null || populationOf(zone, sp.ancestor) < p.minAncestor) return null;
  const ctx = { data, state, zone };
  if (sp.tier >= p.pressure.fromTier && !holdsAll(p.pressure.when, ctx)) return null;
  if (!holdsAll(sp.evolve, ctx)) return null;
  return settleZone(data, state, zone, sp, p);
}

export const evolution = defineRule({
  ...spec,
  run({ data, state, params, emit, rng }) {
    for (const zone of state.zones)
      for (const sp of data.species.values()) {
        const target = evolutionTarget(data, state, zone, sp, params);
        if (!target) {
          delete zone.evolution[sp.id];
          continue;
        }
        const held = (zone.evolution[sp.id] ?? 0) + 1;
        if (held < params.rounds) {
          zone.evolution[sp.id] = held;
          continue;
        }
        delete zone.evolution[sp.id];
        const ancestor = sp.ancestor!;
        const count = Math.min(
          params.amount,
          populationOf(zone, ancestor),
          lifeParams(data).max - populationOf(target, sp.id),
        );
        const first = !(sp.id in state.species);
        setPopulation(data, state, zone, ancestor, populationOf(zone, ancestor) - count, emit, 'evolution');
        setPopulation(data, state, target, sp.id, populationOf(target, sp.id) + count, emit, 'evolution');
        emit({ type: 'speciesEmerged', species: sp.id, ancestor, from: zone.id, zone: target.id, first });
        if (first) addGifts(state, sp, (n) => rng.int(n), emit);
      }
  },
});
