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
  | { type: 'advance' }
  /** ein angebotenes Merkmal wählen (Id aus traits.yaml) */
  | { type: 'pickTrait'; trait: string }
  /** zur nächsten Stufe springen (nur wenn reif, unumkehrbar) */
  | { type: 'evolve' };

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
  /**
   * die Stufe der Herde betritt dieses Feld nicht (Hindernis, z. B. Altwald für Wanderer), obwohl es begehbar ist.
   * `view` setzt es immer; optional nur, damit vorhandene Oberflächen-Tests mit Feld-Literalen weiter kompilieren.
   */
  blocked?: boolean;
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

/** Bedürfnisse einer Stufe (nur Ids; Namen stehen in den Daten). */
export interface StageNeedsView {
  /** Stufen-Id (stages.yaml) */
  id: string;
  /** Landschaften, die als Futter zählen */
  eats: string[];
  /** Futter-Maximum je Landschaft für diese Stufe (nur Landschaften aus `eats`) */
  food: Record<string, number>;
  water: string[];
  /** Jahreszeiten mit Durst (alle Jahreszeiten bei „ganzjährig“) */
  waterSeasons: string[];
  shelter: string[];
  /** Jahreszeiten mit Kälte */
  shelterSeasons: string[];
  /** Landschaften, die die Stufe nicht betritt */
  blocked: string[];
  /** Felder je Monat */
  move: number;
  /** Umkreis für Fressen, Wasser, Schutz */
  reach: number;
}

export interface ExperienceView {
  /** Erfahrungs-Id (traits.yaml → experiences) */
  id: string;
  value: number;
  /** nächstes noch nicht erreichtes Merkmal dieser Erfahrung und seine Schwelle */
  next: { trait: string; at: number } | null;
}

/** Entwicklung der Herde: Stufe, Merkmale, Angebot, Erfahrung, Reife, Vorschau der nächsten Stufe. */
export interface EvolutionView {
  stage: StageNeedsView;
  /** gewählte Merkmale (Reihenfolge der Wahl); alle wirken, auch die aus früheren Stufen */
  traits: string[];
  /**
   * Merkmale, die auf dieser Stufe für die Reife zählen (Teilmenge von `traits`). Bei `mature.scope: stage` nur die
   * auf dieser Stufe gewählten; die übrigen Merkmale wirken, zählen aber nicht.
   */
  counted: string[];
  /** angebotene Merkmale; `pickTrait` mit einer dieser Ids */
  offer: string[];
  /**
   * Merkmale, deren Schwelle erreicht ist (Daten-Reihenfolge). Was davon nicht in `offer` steht, kommt in einem
   * späteren Angebot (das Angebot rotiert, wenn es liegen bleibt).
   */
  available: string[];
  experience: ExperienceView[];
  /** reif: `evolve` ist möglich */
  mature: boolean;
  /**
   * was zur Reife auf dieser Stufe noch fehlt; null auf der letzten Stufe. `required`: so viele zählende Merkmale
   * braucht die Reife; `traits`: so viele fehlen davon noch; `oneOf`: eines davon muss noch gewählt werden.
   */
  missing: { required: number; traits: number; oneOf: string[] | null } | null;
  /** Bedürfnisse der nächsten Stufe (zum Vorplanen); null auf der letzten Stufe */
  next: StageNeedsView | null;
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
  evolution: EvolutionView;
  over: Outcome | null;
}
