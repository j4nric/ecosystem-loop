/**
 * Vertrag für Oberflächen (App, Konsole, Bots): Aktionen, Lesemodell, Prüfergebnis. Nur Typen.
 * Texte liefert die Engine nicht; Namen von Landschaften, Karten, Jahreszeiten und Monaten stehen in den Daten
 * (`data.landscapes.get(id).name.de` …), Meldungen zu Ereignissen und Gründen setzt die Oberfläche zusammen.
 */
import type { HerdeEvent, HerdeState, Outcome, Pos, ReasonId } from './state.ts';

export type { HerdeEvent, HerdeState, Outcome, Pos, ReasonId };

export type Action =
  /** Karte an Handposition `hand` ausspielen; globale Karten ohne x/y */
  | { type: 'play'; hand: number; x?: number; y?: number }
  /** einen Monat weiter */
  | { type: 'advance' };

export interface NewGameOptions {
  seed: number | string;
  /** Insel-Id (islands.yaml); Standard: die erste Insel */
  island?: string;
}

export interface StepResult {
  state: HerdeState;
  events: HerdeEvent[];
}

export type StateCheck = { ok: true } | { ok: false; reason: string };

/** Was ein Feld von selbst tun wird (Sukzession). */
export interface CellForecast {
  /** Landschaft danach */
  to: string;
  /** Zahl der Monatsschritte bis zum Wandel (≥ 1); bei clock „ungrazed“ nur, wenn bis dahin keiner grast */
  inMonths: number;
  clock: 'age' | 'ungrazed';
  /** das neue Feld ist fruchtbar (Brand → Wiese) */
  fertile: boolean;
}

export interface CellView extends Pos {
  land: string;
  food: number;
  maxFood: number;
  fertile: boolean;
  walkable: boolean;
  forecast: CellForecast | null;
  /** kann in einer Feuer-Jahreszeit von selbst brennen */
  wildfire: boolean;
  herd: boolean;
  /** Id des Rudels auf dem Feld oder null */
  pack: number | null;
}

export interface HerdView extends Pos {
  stage: string;
  size: number;
  fat: number;
  fatMax: number;
  /** Monate ohne Wasser in der Wasser-Jahreszeit */
  thirst: number;
}

export interface PackView extends Pos {
  id: number;
  size: number;
  /** hungrig: zieht durchs Gehölz zur Herde */
  hungry: boolean;
}

/** Absicht der Herde für den nächsten Monat: genau das Feld, auf das `advance` sie führt. */
export interface IntentView extends Pos {
  dx: number;
  dy: number;
  stays: boolean;
  reason: ReasonId;
}

export interface HandCardView {
  index: number;
  card: string;
  global: boolean;
  wild: number;
  /** gültige Zielfelder (leer bei globalen Karten) */
  targets: Pos[];
}

export interface HerdeView {
  island: string;
  width: number;
  height: number;
  /** vergangene Monate seit Beginn */
  month: number;
  /** Jahr ab 1 */
  year: number;
  /** Monat im Jahr ab 0 (Namen: data.months) */
  monthOfYear: number;
  /** Jahreszeit-Id (in der Eiszeit die Eiszeit-Jahreszeit) */
  season: string;
  ice: { active: boolean; monthsLeft: number; months: number };
  wild: { value: number; max: number };
  /** Felder Zeile für Zeile */
  cells: CellView[];
  herd: HerdView;
  packs: PackView[];
  /** null, wenn die Partie vorbei ist */
  intent: IntentView | null;
  hand: HandCardView[];
  handMax: number;
  over: Outcome | null;
}
