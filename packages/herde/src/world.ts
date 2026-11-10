/** Kleine gemeinsame Abfragen auf Insel, Feldern und Jahreszeit sowie der Landschaftswandel. */
import {
  STAGE_STATS,
  type HerdeData,
  type Island,
  type Landscape,
  type Season,
  type SeasonSet,
  type Stage,
  type StageStat,
} from './schema.ts';
import type { CellState, Emit, HerdeState, Pos } from './state.ts';

/** Regelverstoß einer Aktion (ungültiger Zug, Partie vorbei …). */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

export function islandOf(data: HerdeData, s: HerdeState): Island {
  const island = data.islands.get(s.island);
  if (!island) throw new RuleError(`Unbekannte Insel: ${s.island}`);
  return island;
}

export function inside(island: Island, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < island.width && y < island.height;
}

export function cellAt(data: HerdeData, s: HerdeState, x: number, y: number): CellState {
  return s.cells[y * islandOf(data, s).width + x]!;
}

/** Felder im Umkreis r (Chebyshev, inkl. Mitte), Zeile für Zeile von oben links – die Reihenfolge entscheidet Gleichstände. */
export function around(island: Island, x: number, y: number, r = 1): Pos[] {
  const out: Pos[] = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (inside(island, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  return out;
}

export const cheb = (a: Pos, b: Pos): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

export function landOf(data: HerdeData, cell: CellState): Landscape {
  const l = data.landscapes.get(cell.land);
  if (!l) throw new RuleError(`Unbekannte Landschaft: ${cell.land}`);
  return l;
}

/**
 * Futter-Maximum eines Felds (inkl. Fruchtbarkeit) für die aktuelle Stufe: `forage` der Stufe überlagert das
 * Maximum der Landschaft, der Fruchtbarkeitsbonus kommt immer von der Landschaft.
 */
export function maxFood(data: HerdeData, s: HerdeState, cell: CellState): number {
  const l = landOf(data, cell);
  const base = baseStageOf(data, s).forage[cell.land]?.food ?? l.food;
  return base + (cell.fertile > 0 ? l.fertileBonus : 0);
}

/** Futter-Wachstum eines Felds je Monat in einer Jahreszeit (forage der Stufe vor den Werten der Landschaft). */
export function growOf(data: HerdeData, s: HerdeState, cell: CellState, season: string): number {
  const grow = baseStageOf(data, s).forage[cell.land]?.grow ?? landOf(data, cell).grow;
  return grow[season] ?? 0;
}

export const yearLength = (data: HerdeData): number => data.seasons.length * data.monthsPerSeason;

/** Index der aktuellen Jahreszeit; während der Eiszeit gilt die Eiszeit-Jahreszeit. */
export function seasonIndex(data: HerdeData, s: HerdeState): number {
  if (s.ice > 0) return data.seasons.findIndex((x) => x.id === data.params.ice.season);
  return Math.floor((s.month % yearLength(data)) / data.monthsPerSeason);
}

export const seasonOf = (data: HerdeData, s: HerdeState): Season => data.seasons[seasonIndex(data, s)]!;

/** Die Stufe der Herde, wie sie in den Daten steht (ohne Merkmale). */
export function baseStageOf(data: HerdeData, s: HerdeState): Stage {
  const stage = data.stages.get(s.herd.stage);
  if (!stage) throw new RuleError(`Unbekannte Stufe: ${s.herd.stage}`);
  return stage;
}

/** Stufenwerte, die ganzzahlig bleiben, und Untergrenzen nach einer Änderung durch Merkmale (sonst 0). */
const INT_STATS: ReadonlySet<StageStat> = new Set(['thirstAfter', 'move', 'reach', 'trail', 'wolfGuard']);
const MIN_STATS: Partial<Record<StageStat, number>> = { eatFactor: 1, thirstAfter: 1, move: 1, reach: 1 };

/**
 * Die Stufe der Herde mit den Wirkungen ihrer Merkmale (Wert × mul + add, in der Reihenfolge der Wahl).
 * Alle Regeln lesen ihre Werte hierüber. Ohne Merkmale ist es genau die Stufe aus den Daten.
 */
export function stageOf(data: HerdeData, s: HerdeState): Stage {
  const base = baseStageOf(data, s);
  if (s.herd.traits.length === 0) return base;
  const stage: Stage = { ...base };
  for (const id of s.herd.traits) {
    const trait = data.traits.get(id);
    if (!trait) throw new RuleError(`Unbekanntes Merkmal: ${id}`);
    for (const e of trait.effects) stage[e.stat] = stage[e.stat] * (e.mul ?? 1) + (e.add ?? 0);
  }
  for (const stat of STAGE_STATS) {
    const v = INT_STATS.has(stat) ? Math.round(stage[stat]) : stage[stat];
    stage[stat] = Math.max(MIN_STATS[stat] ?? 0, v);
  }
  return stage;
}

/** Gilt ein Bedürfnis (Jahreszeiten aus `needs`) in dieser Jahreszeit? */
export const inSeasons = (set: SeasonSet, season: Season): boolean => set === 'all' || set.includes(season.id);

/** Braucht die Herde jetzt Wasser bzw. Schutz (nach ihrer Stufe und der Jahreszeit)? */
export function needsNow(data: HerdeData, s: HerdeState, need: 'water' | 'shelter'): boolean {
  return inSeasons(baseStageOf(data, s).needs[need], seasonOf(data, s));
}

/** Kann die Herde in ihrer Stufe die Landschaft betreten? */
export function walkable(data: HerdeData, s: HerdeState, land: string): boolean {
  return data.landscapes.get(land)?.walk === true && !baseStageOf(data, s).blocked.includes(land);
}

/** Liegt im Umkreis r (inkl. Feld selbst) eine der Landschaften? */
export function near(data: HerdeData, s: HerdeState, x: number, y: number, lands: readonly string[], r = 1): boolean {
  return around(islandOf(data, s), x, y, r).some((p) => lands.includes(cellAt(data, s, p.x, p.y).land));
}

/**
 * Felder, die die Herde in diesem Monat erreichen kann: höchstens `steps` Schritte (8er-Nachbarschaft) nur über
 * Felder, die ihre Stufe betreten kann. Das eigene Feld gehört immer dazu. Reihenfolge wie `around` (Zeile für
 * Zeile von oben links) – sie entscheidet Gleichstände.
 */
export function reachable(data: HerdeData, s: HerdeState, from: Pos, steps: number): Pos[] {
  const island = islandOf(data, s);
  const key = (p: Pos) => p.y * island.width + p.x;
  const seen = new Set<number>([key(from)]);
  let frontier: Pos[] = [from];
  for (let i = 0; i < steps; i++) {
    const next: Pos[] = [];
    for (const p of frontier)
      for (const q of around(island, p.x, p.y)) {
        if (seen.has(key(q)) || !walkable(data, s, cellAt(data, s, q.x, q.y).land)) continue;
        seen.add(key(q));
        next.push(q);
      }
    frontier = next;
  }
  return around(island, from.x, from.y, steps).filter((p) => seen.has(key(p)));
}

/** Summe der Rudelstärken im Umkreis 1. */
export function packsNear(s: HerdeState, x: number, y: number): number {
  return s.packs.filter((p) => cheb(p, { x, y }) <= 1).reduce((a, p) => a + p.size, 0);
}

export interface TransformOptions {
  /** Futter nach dem Wandel; ohne Angabe gekappt auf das neue Maximum */
  food?: number;
  /** Monate fruchtbar; ohne Angabe bleibt der bisherige Wert */
  fertile?: number;
  cause: 'succession' | 'card' | 'fire';
}

/**
 * Ein Feld wird zu einer anderen Landschaft: Alter 0, gilt als eben beweidet (die Uhr der Verbuschung beginnt
 * neu), Futter gesetzt oder gekappt. Wird das Feld dabei zu Nicht-Gehölz, verlieren Rudel dort ihren Lebensraum
 * (Feuer und Fels vertreiben Wölfe, Konzept 6).
 */
export function transform(data: HerdeData, s: HerdeState, pos: Pos, to: string, opts: TransformOptions, emit: Emit) {
  const cell = cellAt(data, s, pos.x, pos.y);
  const from = cell.land;
  cell.land = to;
  cell.age = 0;
  // AUSLEGUNG: Jeder Landschaftswechsel setzt die Beweidungs-Uhr zurück. Der Prototyp tut das nur beim Säen
  // und bei Brand → Wiese; für alle anderen Ziele ist die Uhr bedeutungslos, das Ergebnis also gleich.
  cell.grazed = s.month;
  if (opts.fertile !== undefined) cell.fertile = opts.fertile;
  cell.food = opts.food ?? Math.min(cell.food, maxFood(data, s, cell));
  emit({ type: 'cellChanged', x: pos.x, y: pos.y, from, to, cause: opts.cause });
  if (!landOf(data, cell).wood) {
    const gone = s.packs.filter((p) => samePos(p, pos));
    s.packs = s.packs.filter((p) => !samePos(p, pos));
    for (const p of gone)
      emit({ type: 'packGone', pack: p.id, x: p.x, y: p.y, cause: opts.cause === 'fire' ? 'fire' : 'driven' });
  }
}
