/**
 * Bestände der Arten (Konzept 5.1): Parameter des Moduls `life`, Lesen und Setzen von Beständen,
 * Lebenslauf der Arten (erstmals gelebt, ausgestorben). Von Regeln, Effekten und Ansicht gemeinsam genutzt.
 */
import { z } from 'zod';
import { paramsOf } from './rules/module.ts';
import { Effect, Id, type GameData, type SpeciesDef } from './schema/index.ts';
import type { GameEvent, GameState, ZoneState } from './state.ts';
import { clamp, RuleError } from './world.ts';

export const LifeParams = z.strictObject({
  /** Höchster Bestand je Art und Zone. */
  max: z.number().int().positive(),
  food: z.strictObject({
    /** So viele Tiere ernährt 1 Punkt eines Nahrungswerts (Vegetation, Totholz, Licht …). */
    perStat: z.number().positive(),
    /** So viele Räuber ernährt 1 Beutetier. */
    perPrey: z.number().positive(),
    /** Räuber jagen auch in Nachbarzonen. */
    huntNeighbors: z.boolean(),
  }),
  /** Wachstum bei ausreichender Nahrung und passender Form. */
  growth: z.number().int().nonnegative(),
  /** Hunger: Verlust bei zu wenig Nahrung. */
  hunger: z.number().int().nonnegative(),
  /** Verlust außerhalb des Lebensraums in einer verödeten Form. */
  degradedLoss: z.number().int().nonnegative(),
  /** Überweidung: Effekte auf die Zone („self“), wenn hungrige Tiere einen Nahrungswert leer fressen. */
  overuse: z.record(Id, z.array(Effect)).default({}),
  /** Zu viele Räuber: Verlust der leergefressenen Beute. */
  overhunt: z.number().int().nonnegative(),
  /** Jäger (`hunts` einer Art) senken jeden gejagten Bestand ihrer Zone um so viel. */
  hunt: z.number().int().nonnegative(),
  migration: z.strictObject({
    /** Ab diesem Bestand wandern Tiere in eine passende Nachbarzone … */
    from: z.number().int().positive(),
    /** … und zwar so viele. */
    amount: z.number().int().positive(),
  }),
});
export type LifeParams = z.infer<typeof LifeParams>;

export const lifeSpec = { id: 'life', params: LifeParams };

export function lifeParams(data: GameData): LifeParams {
  return paramsOf(data, lifeSpec);
}

export function getSpecies(data: GameData, id: string): SpeciesDef {
  const s = data.species.get(id);
  if (!s) throw new RuleError(`Unbekannte Art: ${id}`);
  return s;
}

export function populationOf(zone: ZoneState, species: string): number {
  return zone.populations[species] ?? 0;
}

/** Gesamtbestand einer Art auf der Insel. */
export function totalPopulation(state: GameState, species: string): number {
  return state.zones.reduce((n, z) => n + populationOf(z, species), 0);
}

/** Merkt sich, dass eine Art lebt (erstmals oder nach dem Aussterben wieder). */
export function noteAlive(state: GameState, species: string): void {
  const rec = state.species[species];
  if (!rec) state.species[species] = { since: state.round, extinct: null };
  else rec.extinct = null;
}

/** Setzt einen Bestand (begrenzt auf 0–max) und meldet die Änderung. Bestand 0 wird aus der Zone entfernt. */
export function setPopulation(
  data: GameData,
  state: GameState,
  zone: ZoneState,
  species: string,
  value: number,
  emit: (e: GameEvent) => void,
  cause: string,
): void {
  getSpecies(data, species);
  const from = populationOf(zone, species);
  const to = clamp(value, 0, lifeParams(data).max);
  if (to === from) return;
  if (to === 0) delete zone.populations[species];
  else {
    zone.populations[species] = to;
    noteAlive(state, species);
  }
  emit({ type: 'populationChanged', zone: zone.id, species, from, to, cause });
}

/** Arten, die je gelebt haben, aber jetzt nirgends mehr leben, sterben aus (einmalig je Aussterben). */
export function checkExtinctions(state: GameState, emit: (e: GameEvent) => void): void {
  for (const [species, rec] of Object.entries(state.species)) {
    if (rec.extinct !== null || totalPopulation(state, species) > 0) continue;
    rec.extinct = state.round;
    emit({ type: 'speciesExtinct', species });
  }
}

/** Lebende Arten in Daten-Reihenfolge. */
export function livingSpeciesDefs(data: GameData, state: GameState): SpeciesDef[] {
  return [...data.species.values()].filter((s) => totalPopulation(state, s.id) > 0);
}

/** Gaben einer Art als neue Karten an zufälligen Stellen in den Nachziehstapel mischen. */
export function addGifts(
  state: GameState,
  species: SpeciesDef,
  pickIndex: (n: number) => number,
  emit: (e: GameEvent) => void,
): void {
  for (const card of species.gift) {
    const inst = { uid: state.nextUid++, card };
    state.drawPile.splice(pickIndex(state.drawPile.length + 1), 0, inst);
    emit({ type: 'giftAdded', species: species.id, card, uid: inst.uid });
  }
}
