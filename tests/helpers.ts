import { getZone } from '../src/core/conditions.ts';
import { createExpedition } from '../src/core/engine.ts';
import type { GameData, Values } from '../src/core/schema.ts';
import type { ExpeditionState } from '../src/core/state.ts';
import { loadGameData } from '../src/node/load.ts';

export const data: GameData = loadGameData();

/** Daten mit überschriebenen Config-Werten (tiefe Kopie, Original bleibt unverändert). */
export function withConfig(patch: (c: GameData['config']) => void): GameData {
  const config = structuredClone(data.config);
  patch(config);
  return { ...data, config };
}

/** Expedition mit kontrollierter Hand und leerem Wald (keine Tiere). */
export function setup(
  opts: { hand?: string[]; draw?: string[]; d?: GameData; seed?: string } = {},
): ExpeditionState {
  const d = opts.d ?? data;
  const s = createExpedition(d, { deck: d.config.starterDeck, seed: opts.seed ?? 'test' });
  let uid = 1000;
  s.hand = (opts.hand ?? []).map((card) => ({ uid: uid++, card }));
  s.drawPile = (opts.draw ?? ['seeds', 'seeds', 'seeds', 'seeds']).map((card) => ({ uid: uid++, card }));
  s.discardPile = [];
  s.log = [];
  return s;
}

export function setValues(s: ExpeditionState, zone: string, v: Partial<Values>): void {
  Object.assign(getZone(s, zone).values, v);
}

export function addAnimal(s: ExpeditionState, zone: string, animal: string): void {
  getZone(s, zone).animals.push({ id: animal, arrivedTurn: 0, withPredatorTurns: 0 });
}

export function animalsIn(s: ExpeditionState, zone: string): string[] {
  return getZone(s, zone).animals.map((a) => a.id);
}

export function uidOf(s: ExpeditionState, card: string, nth = 0): number {
  const c = s.hand.filter((x) => x.card === card)[nth];
  if (!c) throw new Error(`${card} nicht auf der Hand`);
  return c.uid;
}

/** Alle Zonen auf neutrale Werte setzen, an denen kein Tier Interesse hat. */
export function neutralForest(s: ExpeditionState): void {
  for (const z of s.zones) z.values = { light: 1, moisture: 2, density: 2, deadwood: 0 };
}
