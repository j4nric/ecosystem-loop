/** Gemeinsame Hilfen der Tests: Daten, konstruierte Zustände, Prototyp-Logik. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { newGame, step, type Action, type HerdeData, type HerdeEvent, type HerdeState } from '../src/index.ts';
import { loadData } from '../src/node/load.ts';

export const data: HerdeData = loadData();

/** Testinsel 7 × 7 nur für konstruierte Zustände (nicht in den YAML-Daten). */
export const SIZE = 7;
data.islands.set('test', {
  id: 'test',
  name: { de: 'Test', en: 'Test' },
  width: SIZE,
  height: SIZE,
  cells: Array.from({ length: SIZE * SIZE }, () => 'steppe'),
  herd: { x: 3, y: 3 },
  packs: [],
});

/** Konstruierter Zustand: Testinsel ganz aus Steppe mit Futter 0, Herde (10 Tiere) in der Mitte, keine Rudel. */
export function blank(): HerdeState {
  const s = newGame(data, { seed: 1, island: 'test' });
  s.cells.forEach((c) => Object.assign(c, { food: 0, age: 0, fertile: 0, grazed: 0 }));
  s.hand = [];
  return s;
}

export function at(s: HerdeState, x: number, y: number) {
  const w = data.islands.get(s.island)!.width;
  return s.cells[y * w + x]!;
}

/** Feld setzen (Landschaft, optional Futter usw.). */
export function put(
  s: HerdeState,
  x: number,
  y: number,
  land: string,
  extra: Partial<HerdeState['cells'][number]> = {},
) {
  Object.assign(at(s, x, y), { land, ...extra });
}

export function addPack(s: HerdeState, x: number, y: number, size = 1, extra: { fed?: number; hungry?: number } = {}) {
  const pack = { id: s.nextPackId++, x, y, size, fed: extra.fed ?? 0, hungry: extra.hungry ?? 0 };
  s.packs.push(pack);
  return pack;
}

/** Monat in einer Jahreszeit setzen (0 Frühling, 1 Sommer, 2 Herbst, 3 Winter), zweiter Monat der Jahreszeit. */
export function season(s: HerdeState, index: number, monthInSeason = 1): HerdeState {
  s.month = 12 + index * 3 + monthInSeason;
  return s;
}

export function advance(s: HerdeState): { state: HerdeState; events: HerdeEvent[] } {
  return step(data, s, { type: 'advance' });
}

export function act(s: HerdeState, action: Action) {
  return step(data, s, action);
}

export const ofType = <T extends HerdeEvent['type']>(events: HerdeEvent[], type: T) =>
  events.filter((e): e is Extract<HerdeEvent, { type: T }> => e.type === type);

/** Prototyp-Logik aus prototypes/herde/index.html (Skript „logic“), wie im Browser ohne DOM. */
export interface Proto {
  newGame(seed: number): ProtoState;
  nextMonth(s: ProtoState): void;
  playCard(s: ProtoState, hand: number, x: number, y: number): boolean;
  intention(s: ProtoState): { x: number; y: number; why: string };
}
export interface ProtoState {
  rs: number;
  month: number;
  ice: number;
  wild: number;
  over: string | null;
  cells: { t: string; food: number; age: number; fert: number; grazed: number }[];
  herd: { x: number; y: number; n: number; fat: number; thirst: number; trail: { x: number; y: number }[] };
  packs: { x: number; y: number; size: number; fed: number; hungry: number }[];
  hand: string[];
}

export function loadPrototype(): Proto {
  const file = resolve(import.meta.dirname, '../../../prototypes/herde/index.html');
  const html = readFileSync(file, 'utf8');
  const src = html.split('<script id="logic">')[1]!.split('</script>')[0]!;
  const mod: { exports: unknown } = { exports: {} };
  new Function('module', 'window', src)(mod, undefined);
  return mod.exports as Proto;
}

/** Kopie der Daten mit geänderten Werten (z. B. Feuerchance 1), damit Zufallsregeln sicher eintreten. */
export function tweak(fn: (d: HerdeData) => void): HerdeData {
  const d = structuredClone(data);
  fn(d);
  return d;
}

/** Herde für lange Testläufe am Leben halten (Größe 10, voller Vorrat). */
export function keepAlive(s: HerdeState): HerdeState {
  s.herd.size = 10;
  s.herd.fat = 20;
  return s;
}

export const NEIGHBORS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];
