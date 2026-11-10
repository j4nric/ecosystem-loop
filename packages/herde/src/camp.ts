/**
 * Lager der Herde (Konzept 9.2, Stufe 5 Mensch): gültige Lagerplätze, Niederlassen (`settle`), Rodung im Jahreslauf.
 * Ohne Zufall.
 */
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos } from './state.ts';
import {
  around,
  baseStageOf,
  cellAt,
  islandOf,
  reachable,
  RuleError,
  samePos,
  stageOf,
  transform,
  walkable,
  yearLength,
} from './world.ts';

/** Ist das Feld ein gültiger Lagerplatz (je eine Landschaft jeder Gruppe aus `camp.near` im Umkreis `radius`)? */
export function campSiteOk(data: HerdeData, s: HerdeState, p: Pos): boolean {
  const camp = baseStageOf(data, s).camp;
  if (!camp || !walkable(data, s, cellAt(data, s, p.x, p.y).land)) return false;
  const lands = around(islandOf(data, s), p.x, p.y, camp.radius).map((q) => cellAt(data, s, q.x, q.y).land);
  return camp.near.every((group) => group.some((id) => lands.includes(id)));
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
  const spots = around(islandOf(data, s), s.camp.x, s.camp.y, camp.radius);
  for (const land of clear.lands) {
    const p = spots.find((q) => cellAt(data, s, q.x, q.y).land === land);
    if (!p) continue;
    emit({ type: 'fieldCleared', x: p.x, y: p.y, from: land, to: clear.to });
    transform(data, s, p, clear.to, { cause: 'clearing' }, emit);
    return;
  }
}
