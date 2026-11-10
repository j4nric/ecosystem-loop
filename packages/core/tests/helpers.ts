import { buildGameData, type RawData } from '../src/data.ts';
import { newGame, step } from '../src/game.ts';
import { readRawData } from '../src/node/load.ts';
import { RULES } from '../src/rules/index.ts';
import { rngOf } from '../src/rng.ts';
import type { GameData } from '../src/schema/index.ts';
import type { GameEvent, GameState, ZoneState } from '../src/state.ts';
import { getZone } from '../src/world.ts';

export const raw: RawData = readRawData();
export const data: GameData = buildGameData(raw);

/** Daten aus veränderten Rohdaten (tiefe Kopie, Original bleibt unverändert). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tests verändern Rohdaten gezielt, auch ungültig.
type Loose = any;

export function dataWith(patch: (r: Loose) => void): GameData {
  const r = structuredClone(raw) as Loose;
  patch(r);
  return buildGameData(r as RawData);
}

/** Partie mit kontrollierter Hand, kontrolliertem Stapel und Odem. Zonen behalten die Ruhewerte. */
export function game(
  opts: { hand?: string[]; draw?: string[]; breath?: number; d?: GameData; seed?: string; scenario?: string } = {},
): GameState {
  const d = opts.d ?? data;
  const s = newGame(d, { seed: opts.seed ?? 'test', scenario: opts.scenario });
  let uid = 1000;
  if (opts.hand) s.hand = opts.hand.map((card) => ({ uid: uid++, card }));
  if (opts.draw) s.drawPile = opts.draw.map((card) => ({ uid: uid++, card }));
  if (opts.hand || opts.draw) s.discardPile = [];
  if (opts.breath !== undefined) s.breath = opts.breath;
  return s;
}

export function zone(s: GameState, id: string): ZoneState {
  return getZone(s, id);
}

export function setStats(s: GameState, id: string, v: Record<string, number>): void {
  Object.assign(getZone(s, id).stats, v);
}

export function uidOf(s: GameState, card: string, nth = 0): number {
  const c = s.hand.filter((x) => x.card === card)[nth];
  if (!c) throw new Error(`${card} nicht auf der Hand`);
  return c.uid;
}

/** Spielt eine Karte über die Fassade und gibt neuen Zustand + Ereignisse zurück. */
export function play(s: GameState, card: string, targets: Record<string, string> = {}, d: GameData = data) {
  return step(d, s, { type: 'play', uid: uidOf(s, card), targets });
}

export function endTurn(s: GameState, d: GameData = data) {
  return step(d, s, { type: 'endTurn' });
}

/** Führt einzelne Regel-Module direkt auf dem Zustand aus (verändert ihn). */
export function runRules(s: GameState, ids: string[], d: GameData = data): GameEvent[] {
  const events: GameEvent[] = [];
  for (const id of ids)
    RULES.get(id)!.run({ data: d, state: s, params: d.params[id], emit: (e) => events.push(e), rng: rngOf(s) });
  return events;
}

/** Ruhewerte einer Geografie als Kopie. */
export function rest(geography: string): Record<string, number> {
  return { ...data.geographies.get(geography)!.rest };
}
