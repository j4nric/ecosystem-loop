/**
 * Effektsprache: eine Funktion für Karten, Schwellen, Jahreszeiten und Kopplungen.
 * `bind` ordnet Namen (Slot-Ids, "self", "source") Zonen-Ids zu.
 */
import type { Effect, GameData, Scope } from '../schema/index.ts';
import type { GameEvent, GameState, ZoneState } from '../state.ts';
import { lifeParams, populationOf, setPopulation } from '../population.ts';
import { breathMax } from '../rules/breath.ts';
import { clamp, geographyOf, getZone, RuleError } from '../world.ts';
import { drawUpTo } from './deck.ts';

export interface EffectContext {
  data: GameData;
  state: GameState;
  emit: (e: GameEvent) => void;
  bind: Record<string, string>;
  /** Ursache für das Ereignislog, z. B. "card:rain", "season:summer", "coupling:flood", "healing". */
  cause: string;
}

export function boundZone(ctx: EffectContext, at: string): ZoneState {
  const id = ctx.bind[at];
  if (id === undefined) throw new RuleError(`Effektziel nicht gebunden: ${at}`);
  return getZone(ctx.state, id);
}

export function zonesFor(ctx: EffectContext, at: string, scope: Scope): ZoneState[] {
  if (scope === 'all') return ctx.state.zones;
  const zone = boundZone(ctx, at);
  const neighbors = zone.neighbors.map((n) => getZone(ctx.state, n));
  if (scope === 'neighbors') return neighbors;
  if (scope === 'area') return [zone, ...neighbors];
  return [zone];
}

/** Setzt einen Wert (begrenzt auf die Skala) und meldet die Änderung. Fehlt der Wert in der Zone: nichts. */
export function setStat(
  data: GameData,
  zone: ZoneState,
  stat: string,
  value: number,
  emit: (e: GameEvent) => void,
  cause: string,
): void {
  const from = zone.stats[stat];
  if (from === undefined) return;
  const to = clamp(value, data.config.scale.min, data.config.scale.max);
  if (to === from) return;
  zone.stats[stat] = to;
  emit({ type: 'statChanged', zone: zone.id, stat, from, to, cause });
}

/** Bewegt einen Wert um höchstens `steps` auf den Ruhewert zu (ohne steps: ganz). */
export function towardRest(
  data: GameData,
  zone: ZoneState,
  stat: string,
  steps: number | undefined,
  emit: (e: GameEvent) => void,
  cause: string,
): void {
  const v = zone.stats[stat];
  const rest = geographyOf(data, zone).rest[stat];
  if (v === undefined || rest === undefined) return;
  const d = rest - v;
  const move = steps === undefined ? d : Math.sign(d) * Math.min(Math.abs(d), steps);
  setStat(data, zone, stat, v + move, emit, cause);
}

/** Art eines Effekts: Id eines Art-Slots (gebunden) oder Art-Id. */
function speciesRef(ctx: EffectContext, ref: string): string {
  return ctx.bind[ref] ?? ref;
}

export function applyEffect(ctx: EffectContext, e: Effect): void {
  const { data, state, emit, cause } = ctx;
  if ('adjust' in e) {
    for (const z of zonesFor(ctx, e.at, e.scope)) {
      const v = z.stats[e.adjust];
      if (v !== undefined) setStat(data, z, e.adjust, v + e.by, emit, cause);
    }
  } else if ('set' in e) {
    for (const z of zonesFor(ctx, e.at, e.scope)) setStat(data, z, e.set, e.value, emit, cause);
  } else if ('restore' in e) {
    for (const z of zonesFor(ctx, e.at, e.scope)) {
      const stats = e.restore === 'all' ? Object.keys(z.stats) : [e.restore];
      for (const s of stats) towardRest(data, z, s, e.steps, emit, cause);
    }
  } else if ('transfer' in e) {
    const src = boundZone(ctx, e.from);
    for (const z of zonesFor(ctx, e.at, 'self')) {
      const into = z.stats[e.into];
      // AUSLEGUNG: Es wandert, was die Quelle hat (höchstens amount); was im Ziel über die Skala
      // hinausgeht, geht verloren (ein voller Fluss läuft dann über → Hochwasser).
      const moved = Math.min(e.amount, src.stats[e.transfer] ?? 0);
      if (into === undefined || moved <= 0) continue;
      setStat(data, src, e.transfer, (src.stats[e.transfer] ?? 0) - moved, emit, cause);
      setStat(data, z, e.into, into + moved, emit, cause);
    }
  } else if ('draw' in e) {
    drawUpTo(state, state.hand.length + e.draw, emit);
  } else if ('breath' in e) {
    const from = state.breath;
    const to = clamp(from + e.breath, 0, breathMax(data));
    if (to !== from) {
      state.breath = to;
      emit({ type: 'breathChanged', from, to, cause });
    }
  } else if ('population' in e) {
    const species = speciesRef(ctx, e.population);
    for (const z of zonesFor(ctx, e.at, e.scope))
      setPopulation(data, state, z, species, populationOf(z, species) + e.by, emit, cause);
  } else if ('move' in e) {
    const species = speciesRef(ctx, e.move);
    const src = boundZone(ctx, e.from);
    for (const z of zonesFor(ctx, e.at, 'self')) {
      const moved = Math.min(e.amount, populationOf(src, species), lifeParams(data).max - populationOf(z, species));
      if (moved <= 0 || z === src) continue;
      setPopulation(data, state, src, species, populationOf(src, species) - moved, emit, cause);
      setPopulation(data, state, z, species, populationOf(z, species) + moved, emit, cause);
      emit({ type: 'migrated', species, from: src.id, to: z.id, count: moved });
    }
  } else {
    const never: never = e;
    throw new Error(`Unbekannter Effekt: ${JSON.stringify(never)}`);
  }
}
