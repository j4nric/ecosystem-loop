/**
 * Lager der Herde (Konzept 9.2, Stufe 5 Mensch): gültige Lagerplätze, Niederlassen (`settle`), Rodung im Jahreslauf.
 * Ohne Zufall.
 */
import type { CampPreviewView } from './api.ts';
import type { Camp, HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos } from './state.ts';
import {
  around,
  baseStageOf,
  cellAt,
  inside,
  islandOf,
  preyNear,
  reachable,
  RuleError,
  samePos,
  stageOf,
  transform,
  walkable,
  yearLength,
} from './world.ts';

/**
 * Ist das Feld ein gültiger Lagerplatz (ohne Zugweite)? Landschaft aus `camp.on`, für die Stufe begehbar, und je eine
 * Landschaft jeder Gruppe aus `camp.near` im Umkreis `radius`.
 */
export function campSiteOk(data: HerdeData, s: HerdeState, p: Pos): boolean {
  const camp = baseStageOf(data, s).camp;
  const land = cellAt(data, s, p.x, p.y).land;
  if (!camp || !camp.on.includes(land) || !walkable(data, s, land)) return false;
  return nearCounts(data, s, camp, p).every((n) => n > 0);
}

/** Felder je Gruppe aus `camp.near` im Umkreis `radius` um `p`. */
function nearCounts(data: HerdeData, s: HerdeState, camp: Camp, p: Pos): number[] {
  const lands = around(islandOf(data, s), p.x, p.y, camp.radius).map((q) => cellAt(data, s, q.x, q.y).land);
  return camp.near.map((group) => lands.filter((id) => group.includes(id)).length);
}

/** Zahl der gültigen Lagerplätze auf der ganzen Insel, ohne Zugweite (0 ohne `camp`; für die Vorschau einer Stufe). */
export function campSpotCount(data: HerdeData, s: HerdeState): number {
  if (!baseStageOf(data, s).camp) return 0;
  const island = islandOf(data, s);
  let n = 0;
  for (let y = 0; y < island.height; y++) for (let x = 0; x < island.width; x++) if (campSiteOk(data, s, { x, y })) n++;
  return n;
}

/**
 * Das Feld, das die nächste Rodung an einem Lager bei `p` träfe: das erste aus `clear.lands` (in der Reihenfolge der
 * Liste, dann Zeile für Zeile) im Umkreis `radius`; null ohne passendes Feld oder ohne Rodung.
 */
export function clearTarget(data: HerdeData, s: HerdeState, camp: Camp, p: Pos): Pos | null {
  if (!camp.clear) return null;
  const spots = around(islandOf(data, s), p.x, p.y, camp.radius);
  for (const land of camp.clear.lands) {
    const q = spots.find((c) => cellAt(data, s, c.x, c.y).land === land);
    if (q) return q;
  }
  return null;
}

/**
 * Vorschau eines Lagers bei `pos` für die aktuelle Stufe: was im Umkreis liegt und was die Rodung träfe. null, wenn
 * die Stufe kein Lager kennt oder das Feld nicht auf der Insel liegt. Ob der Platz jetzt wählbar ist, sagt `valid` (wie `campSites`).
 */
export function campPreview(data: HerdeData, s: HerdeState, pos: Pos): CampPreviewView | null {
  const camp = baseStageOf(data, s).camp;
  const island = islandOf(data, s);
  if (!camp || !inside(island, pos.x, pos.y)) return null;
  const stage = stageOf(data, s);
  const reach = around(islandOf(data, s), pos.x, pos.y, stage.reach).map((q) => cellAt(data, s, q.x, q.y).land);
  const counts = nearCounts(data, s, camp, pos);
  const clear = camp.clear;
  const spots = around(islandOf(data, s), pos.x, pos.y, camp.radius);
  return {
    x: pos.x,
    y: pos.y,
    valid: campSites(data, s).some((p) => samePos(p, pos)),
    radius: camp.radius,
    near: camp.near.map((group, i) => ({ lands: [...group], count: counts[i] ?? 0 })),
    reach: stage.reach,
    food: reach.filter((id) => stage.eats.includes(id)).length,
    water: reach.filter((id) => stage.water.includes(id)).length,
    shelter: reach.filter((id) => stage.shelter.includes(id)).length,
    prey: preyNear(s, pos, stage.reach).length,
    moves: !samePos(pos, s.herd),
    clear: clear
      ? {
          lands: [...clear.lands],
          to: clear.to,
          month: clear.month,
          fields: spots.filter((q) => clear.lands.includes(cellAt(data, s, q.x, q.y).land)).length,
          next: clearTarget(data, s, camp, pos),
        }
      : null,
  };
}

/**
 * Lagerplätze, die die Herde jetzt wählen kann: nur auf einer Stufe mit `camp`, ohne Lager, nicht in der Eiszeit,
 * nicht nach dem Ende; Felder, die sie in diesem Monat erreichen könnte (Zeile für Zeile).
 */
export function campSites(data: HerdeData, s: HerdeState): Pos[] {
  if (s.over || s.camp || s.ice > 0 || !baseStageOf(data, s).camp) return [];
  // AUSLEGUNG: Lagerplatz in Zugweite (Schritte `move` der Stufe), nicht irgendwo auf der Insel – die Herde wählt
  // ihren Weg selbst, der Spieler bestimmt nur, wo sie bleibt.
  return reachable(data, s, s.herd, stageOf(data, s).move).filter((p) => campSiteOk(data, s, p));
}

/** Die Herde lässt sich nieder: Sie zieht auf den Lagerplatz und bleibt dort. */
export function settle(data: HerdeData, s: HerdeState, pos: Pos, emit: Emit): void {
  if (!baseStageOf(data, s).camp) throw new RuleError('Diese Stufe gründet kein Lager.');
  if (s.camp) throw new RuleError('Die Herde hat schon ein Lager.');
  // AUSLEGUNG: In der Eiszeit wird kein Lager gegründet. So steht fest, dass ein Lager am Ende einer Eiszeit schon
  // vor ihrem Beginn bestand („danach die nächste Eiszeit überstehen“).
  if (s.ice > 0) throw new RuleError('In der Eiszeit gründet die Herde kein Lager.');
  if (!campSites(data, s).some((p) => samePos(p, pos)))
    throw new RuleError(`(${pos.x},${pos.y}) ist kein gültiger Lagerplatz.`);
  const h = s.herd;
  if (!samePos(h, pos)) {
    h.trail.push({ x: h.x, y: h.y });
    while (h.trail.length > stageOf(data, s).trail) h.trail.shift();
  }
  h.x = pos.x;
  h.y = pos.y;
  s.camp = { x: pos.x, y: pos.y };
  emit({ type: 'campFounded', x: pos.x, y: pos.y });
}

/**
 * Rodung: Einmal im Jahr (Monat `camp.clear.month` im Jahr) wird das erste Feld aus `clear.lands` (in der
 * Reihenfolge der Liste, dann Zeile für Zeile) im Umkreis `radius` des Lagers zu `clear.to`.
 */
export function clearing(data: HerdeData, s: HerdeState, emit: Emit): void {
  const camp = baseStageOf(data, s).camp;
  const clear = camp?.clear;
  if (!s.camp || !camp || !clear || s.month % yearLength(data) !== clear.month || s.herd.size <= 0) return;
  const p = clearTarget(data, s, camp, s.camp);
  if (!p) return;
  emit({ type: 'fieldCleared', x: p.x, y: p.y, from: cellAt(data, s, p.x, p.y).land, to: clear.to });
  transform(data, s, p, clear.to, { cause: 'clearing' }, emit);
}
