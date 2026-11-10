/** Kleine gemeinsame Abfragen auf Insel, Feldern und Jahreszeit sowie der Landschaftswandel. */
import type { HerdeData, Island, Landscape, Season, Stage } from './schema.ts';
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

/** Futter-Maximum eines Felds (inkl. Fruchtbarkeit). */
export function maxFood(data: HerdeData, cell: CellState): number {
  const l = landOf(data, cell);
  return l.food + (cell.fertile > 0 ? l.fertileBonus : 0);
}

export const yearLength = (data: HerdeData): number => data.seasons.length * data.monthsPerSeason;

/** Index der aktuellen Jahreszeit; während der Eiszeit gilt die Eiszeit-Jahreszeit. */
export function seasonIndex(data: HerdeData, s: HerdeState): number {
  if (s.ice > 0) return data.seasons.findIndex((x) => x.id === data.params.ice.season);
  return Math.floor((s.month % yearLength(data)) / data.monthsPerSeason);
}

export const seasonOf = (data: HerdeData, s: HerdeState): Season => data.seasons[seasonIndex(data, s)]!;

export function stageOf(data: HerdeData, s: HerdeState): Stage {
  const stage = data.stages.get(s.herd.stage);
  if (!stage) throw new RuleError(`Unbekannte Stufe: ${s.herd.stage}`);
  return stage;
}

/** Liegt im Umkreis 1 (inkl. Feld selbst) eine der Landschaften? */
export function near(data: HerdeData, s: HerdeState, x: number, y: number, lands: readonly string[]): boolean {
  return around(islandOf(data, s), x, y).some((p) => lands.includes(cellAt(data, s, p.x, p.y).land));
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
  cell.food = opts.food ?? Math.min(cell.food, maxFood(data, cell));
  emit({ type: 'cellChanged', x: pos.x, y: pos.y, from, to, cause: opts.cause });
  if (!landOf(data, cell).wood) {
    const gone = s.packs.filter((p) => samePos(p, pos));
    s.packs = s.packs.filter((p) => !samePos(p, pos));
    for (const p of gone)
      emit({ type: 'packGone', pack: p.id, x: p.x, y: p.y, cause: opts.cause === 'fire' ? 'fire' : 'driven' });
  }
}
