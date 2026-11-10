/**
 * Die Welt verändert sich von selbst (Konzept 4): Graswachstum, Sukzession und Feuer.
 * Die ersten drei Schritte eines Monats, vor dem Zug der Herde.
 */
import { nextFloat } from './rng.ts';
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos } from './state.ts';
import { cellAt, growOf, inside, islandOf, landOf, maxFood, seasonOf, transform } from './world.ts';

const SPREAD: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function ignite(data: HerdeData, s: HerdeState, pos: Pos, burned: Pos[], emit: Emit): void {
  const l = landOf(data, cellAt(data, s, pos.x, pos.y));
  if (!l.burnsTo) return;
  transform(data, s, pos, l.burnsTo, { food: 0, cause: 'fire' }, emit);
  burned.push(pos);
  const island = islandOf(data, s);
  // Tiefensuche in fester Reihenfolge (rechts, links, unten, oben) – Zufall nur für brennbare Nachbarn.
  for (const d of SPREAD) {
    const n = { x: pos.x + d.x, y: pos.y + d.y };
    if (
      inside(island, n.x, n.y) &&
      landOf(data, cellAt(data, s, n.x, n.y)).burnsTo &&
      nextFloat(s) < data.params.fire.spread
    )
      ignite(data, s, n, burned, emit);
  }
}

/**
 * Feuer an einem Feld: Brennbares wird zur Brandfläche, Feuer springt mit fire.spread auf brennbare Nachbarn
 * (4er-Nachbarschaft) über, Rudel auf brennenden Feldern sterben. Liefert die verbrannten Felder.
 */
export function startFire(
  data: HerdeData,
  s: HerdeState,
  pos: Pos,
  cause: 'lightning' | 'wildfire',
  emit: Emit,
): Pos[] {
  const burned: Pos[] = [];
  const buffered: Parameters<Emit>[0][] = [];
  ignite(data, s, pos, burned, (e) => buffered.push(e));
  if (burned.length > 0) emit({ type: 'fire', cause, x: pos.x, y: pos.y, cells: burned });
  for (const e of buffered) emit(e);
  return burned;
}

/**
 * 1. Wachstum: jedes Feld wächst um den Wert seiner Landschaft in dieser Jahreszeit, bis zum Maximum. Hat die Stufe
 * der Herde für die Landschaft eigene Werte (`forage`), gelten diese (Früchte für Waldsammler).
 */
export function grow(data: HerdeData, s: HerdeState): void {
  const season = seasonOf(data, s).id;
  for (const c of s.cells) c.food = Math.min(maxFood(data, s, c), c.food + growOf(data, s, c, season));
}

/** 2. Sukzession: Alter und Fruchtbarkeit laufen, Felder wandeln sich nach ihrer Uhr (höchstens einmal je Monat). */
export function succession(data: HerdeData, s: HerdeState, emit: Emit): void {
  const { width } = islandOf(data, s);
  s.cells.forEach((c, i) => {
    c.age++;
    if (c.fertile > 0) c.fertile--;
    const rule = landOf(data, c).succession;
    if (!rule) return;
    const clock = rule.clock === 'age' ? c.age : s.month - c.grazed;
    if (clock < rule.months) return;
    const opts = { cause: 'succession' as const, food: rule.food, fertile: rule.fertile };
    transform(data, s, { x: i % width, y: Math.floor(i / width) }, rule.to, opts, emit);
  });
}

/** 3. Waldbrand: in Feuer-Jahreszeiten kann jedes Feld mit fireChance von selbst brennen (Zeile für Zeile). */
export function wildfire(data: HerdeData, s: HerdeState, emit: Emit): Pos[] {
  const burned: Pos[] = [];
  if (!seasonOf(data, s).fire) return burned;
  const island = islandOf(data, s);
  for (let y = 0; y < island.height; y++)
    for (let x = 0; x < island.width; x++) {
      const chance = landOf(data, cellAt(data, s, x, y)).fireChance;
      if (chance > 0 && nextFloat(s) < chance) burned.push(...startFire(data, s, { x, y }, 'wildfire', emit));
    }
  return burned;
}

/** Schritte 1–3 eines Monats. Liefert die in diesem Monat verbrannten Felder. */
export function runNature(data: HerdeData, s: HerdeState, emit: Emit): Pos[] {
  grow(data, s);
  succession(data, s, emit);
  return wildfire(data, s, emit);
}
