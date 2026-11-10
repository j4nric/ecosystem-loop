/** Kleine Abfragen auf Daten und Zustand, die Bedingungen, Regeln, Karten und Ansicht teilen. */
import type { FormKind } from './api.ts';
import type { GameData, Geography, Season } from './schema/index.ts';
import type { GameEvent, GameState, ZoneState } from './state.ts';

export class RuleError extends Error {}

export function getZone(state: GameState, id: string): ZoneState {
  const z = state.zones.find((z) => z.id === id);
  if (!z) throw new RuleError(`Unbekannte Zone: ${id}`);
  return z;
}

export function geographyOf(data: GameData, zone: ZoneState): Geography {
  const g = data.geographies.get(zone.geography);
  if (!g) throw new RuleError(`Unbekannte Geografie: ${zone.geography}`);
  return g;
}

/** Werte einer Geografie in Anzeige-Reihenfolge: gemeinsame Werte, dann Sonderwert. */
export function statsOf(data: GameData, geography: Geography): string[] {
  return [...data.commonStats, geography.special];
}

export function seasonOf(data: GameData, round: number): Season {
  const n = data.seasons.length;
  return data.seasons[(data.startSeason + round - 1) % n]!;
}

/** Ein Jahr hat so viele Runden wie es Jahreszeiten gibt. */
export function yearOf(data: GameData, round: number): number {
  return Math.floor((data.startSeason + round - 1) / data.seasons.length) + 1;
}

export function formKindOf(data: GameData, formId: string): FormKind {
  return data.forms.get(formId)?.form.kind ?? 'normal';
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Anzahl Arten mit Bestand > 0 in der Zone (ab Phase 2 relevant). */
export function speciesIn(zone: ZoneState): number {
  return Object.values(zone.populations).filter((n) => n > 0).length;
}

/** Arten, die irgendwo auf der Insel leben. */
export function livingSpecies(state: GameState): number {
  const alive = new Set<string>();
  for (const z of state.zones) for (const [s, n] of Object.entries(z.populations)) if (n > 0) alive.add(s);
  return alive.size;
}

/** Merkt sich die Störung einer Zone in dieser Runde (Zonenstufe jetzt, Selektionsdruck ab Phase 2). */
export function markDisturbance(state: GameState, zone: ZoneState, cause: string, emit: (e: GameEvent) => void): void {
  zone.lastDisturbance = state.round;
  emit({ type: 'disturbance', zone: zone.id, cause });
}
