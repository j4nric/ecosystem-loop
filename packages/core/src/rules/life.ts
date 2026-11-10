/**
 * Leben (Konzept 5.1): Fressen, Wachstum, Hunger, Überpopulation, Jagd, Wanderung, Aussterben.
 * Bestände 0–max je Art und Zone; alle Zahlen unter config.yaml → rules.life.
 */
import { applyEffect } from '../cards/effects.ts';
import { checkExtinctions, getSpecies, lifeSpec, populationOf, setPopulation, type LifeParams } from '../population.ts';
import type { GameData } from '../schema/index.ts';
import type { GameEvent, GameState, ZoneState } from '../state.ts';
import { formKindOf, getZone, seasonOf } from '../world.ts';
import { defineRule } from './module.ts';

/** Ergebnis des Fressens aller Zonen. */
export interface Feeding {
  /** Zone → Arten, die dort nicht satt wurden. */
  hungry: Map<string, string[]>;
  /** Zone → Nahrungsquellen (Wert- oder Art-Id), die hungrige Tiere dort leer gefressen haben. */
  exhausted: Map<string, string[]>;
}

/**
 * Verteilt die Nahrung der Insel. Zonen in Karten-Reihenfolge, je Zone die Arten in Daten-Reihenfolge
 * (niedrige Stufen zuerst), jede Art ihre Nahrung in der Reihenfolge ihres Speiseplans.
 * Pflanzenfresser fressen Werte ihrer Zone; Räuber jagen (mit food.huntNeighbors) auch in Nachbarzonen.
 */
export function feed(data: GameData, state: GameState, p: LifeParams): Feeding {
  // AUSLEGUNG: Konkurrenz um dieselbe Nahrung wird der Reihe nach aufgelöst (erst die Zone, darin niedrige
  // Stufen zuerst). Räuber jagen auch in Nachbarzonen (Revier), weil viele Räuber laut Konzept 4.2 in anderen
  // Formen leben als ihre Beute („Kein Lebensraum genügt allein“).
  const left = new Map<string, number>();
  const capacity = (zone: ZoneState, food: string) =>
    data.species.has(food) ? populationOf(zone, food) * p.food.perPrey : (zone.stats[food] ?? 0) * p.food.perStat;
  const hungry = new Map<string, string[]>();
  const exhausted = new Map<string, Set<string>>();
  for (const zone of state.zones)
    for (const sp of data.species.values()) {
      let need = populationOf(zone, sp.id);
      if (need === 0) continue;
      const sources: [ZoneState, string][] = [];
      for (const food of sp.diet) {
        const zones =
          data.species.has(food) && p.food.huntNeighbors
            ? [zone, ...zone.neighbors.map((n) => getZone(state, n))]
            : [zone];
        for (const z of zones) sources.push([z, food]);
      }
      for (const [z, food] of sources) {
        if (need === 0) break;
        const key = `${z.id}|${food}`;
        if (!left.has(key)) left.set(key, capacity(z, food));
        const take = Math.min(need, left.get(key)!);
        left.set(key, left.get(key)! - take);
        need -= take;
      }
      if (need === 0) continue;
      hungry.set(zone.id, [...(hungry.get(zone.id) ?? []), sp.id]);
      // Überpopulation: Was hungrige Tiere fressen, ist leergefressen (sofern es dort überhaupt etwas gab).
      for (const [z, food] of sources)
        if (capacity(z, food) > 0) exhausted.set(z.id, (exhausted.get(z.id) ?? new Set()).add(food));
    }
  return { hungry, exhausted: new Map([...exhausted].map(([z, f]) => [z, [...f]])) };
}

/** Wachstum, Hunger und Verödung einer Zone – auf Basis der Bestände vor dieser Runde. */
function grow(
  data: GameData,
  state: GameState,
  zone: ZoneState,
  hungry: readonly string[],
  p: LifeParams,
  pausesGrowth: boolean,
  emit: (e: GameEvent) => void,
): void {
  const degraded = formKindOf(data, zone.form) === 'degraded';
  for (const species of Object.keys(zone.populations)) {
    const sp = getSpecies(data, species);
    const n = populationOf(zone, species);
    const set = (delta: number, cause: string) => setPopulation(data, state, zone, species, n + delta, emit, cause);
    if (hungry.includes(species)) {
      emit({ type: 'hunger', zone: zone.id, species });
      set(-p.hunger, 'hunger');
    } else if (!sp.habitat.includes(zone.form)) {
      // AUSLEGUNG: Satt, aber außerhalb des Lebensraums: kein Wachstum; nur in verödeter Form schrumpft der Bestand.
      if (degraded) set(-p.degradedLoss, 'degraded');
    } else if (!pausesGrowth) set(p.growth, 'growth');
  }
}

/** Überpopulation: Überweidung senkt Werte, zu viele Räuber dezimieren die Beute. */
function overuse(
  data: GameData,
  state: GameState,
  zone: ZoneState,
  foods: readonly string[],
  p: LifeParams,
  emit: (e: GameEvent) => void,
): void {
  for (const food of foods) {
    emit({ type: 'overpopulation', zone: zone.id, food });
    if (data.species.has(food))
      setPopulation(data, state, zone, food, populationOf(zone, food) - p.overhunt, emit, 'overhunted');
    else
      for (const e of p.overuse[food] ?? [])
        applyEffect({ data, state, emit, bind: { self: zone.id }, cause: 'overpopulation' }, e);
  }
}

/** Jagd: Arten mit `hunts` (Mensch) senken jeden gejagten Bestand ihrer Zone. */
function hunt(data: GameData, state: GameState, zone: ZoneState, p: LifeParams, emit: (e: GameEvent) => void): void {
  const hunters = Object.keys(zone.populations).map((id) => getSpecies(data, id));
  for (const h of hunters)
    for (const prey of h.hunts)
      if (populationOf(zone, prey) > 0)
        setPopulation(data, state, zone, prey, populationOf(zone, prey) - p.hunt, emit, 'hunted');
}

/** Wanderung: Ab Bestand ≥ from wandern Tiere in die passende Nachbarzone mit dem kleinsten Bestand. */
function migrate(data: GameData, state: GameState, p: LifeParams, emit: (e: GameEvent) => void): void {
  const moves: { species: string; from: ZoneState; to: ZoneState }[] = [];
  for (const zone of state.zones)
    for (const sp of data.species.values()) {
      if (populationOf(zone, sp.id) < p.migration.from) continue;
      // AUSLEGUNG: „passend“ = Form der Nachbarzone gehört zum Lebensraum und dort ist noch Platz;
      // bei Gleichstand gilt die Reihenfolge der Nachbarn (map.yaml).
      let to: ZoneState | null = null;
      for (const n of zone.neighbors) {
        const t = getZone(state, n);
        if (!sp.habitat.includes(t.form) || populationOf(t, sp.id) >= p.max) continue;
        if (!to || populationOf(t, sp.id) < populationOf(to, sp.id)) to = t;
      }
      if (to) moves.push({ species: sp.id, from: zone, to });
    }
  for (const { species, from, to } of moves) {
    const count = Math.min(p.migration.amount, populationOf(from, species), p.max - populationOf(to, species));
    if (count <= 0) continue;
    setPopulation(data, state, from, species, populationOf(from, species) - count, emit, 'migration');
    setPopulation(data, state, to, species, populationOf(to, species) + count, emit, 'migration');
    emit({ type: 'migrated', species, from: from.id, to: to.id, count });
  }
}

export const life = defineRule({
  ...lifeSpec,
  run({ data, state, params, emit }) {
    const pausesGrowth = seasonOf(data, state.round).pausesGrowth;
    const { hungry, exhausted } = feed(data, state, params);
    for (const zone of state.zones) grow(data, state, zone, hungry.get(zone.id) ?? [], params, pausesGrowth, emit);
    for (const zone of state.zones) {
      const foods = exhausted.get(zone.id) ?? [];
      overuse(data, state, zone, foods, params, emit);
      if (hungry.has(zone.id) || foods.length > 0) zone.lastHunger = state.round;
    }
    for (const zone of state.zones) hunt(data, state, zone, params, emit);
    migrate(data, state, params, emit);
    checkExtinctions(state, emit);
  },
});
