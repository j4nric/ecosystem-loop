/**
 * Spielzustand (reines JSON, klonbar mit structuredClone) und Ereignisse.
 * Ereignisse tragen nur Ids und Zahlen; Texte entstehen erst in der Oberfläche.
 */

/** Version des Zustandsformats; bei inkompatiblen Änderungen erhöhen (validateState lehnt alte Stände ab). */
export const STATE_VERSION = 1;

export interface Pos {
  x: number;
  y: number;
}

export interface CellState {
  /** Landschafts-Id */
  land: string;
  food: number;
  /** Monate seit Entstehung (Uhr der Sukzession mit clock: age) */
  age: number;
  /** verbleibende Monate fruchtbar (Bonus auf das Futter-Maximum) */
  fertile: number;
  /** Monat der letzten Beweidung (Uhr der Sukzession mit clock: ungrazed); kann vor Spielbeginn liegen (< 0) */
  grazed: number;
}

export interface HerdState {
  /** Entwicklungsstufe (stages.yaml); bestimmt die Bedürfnisse */
  stage: string;
  x: number;
  y: number;
  size: number;
  /** Vorrat */
  fat: number;
  /** Monate ohne Wasser in einer Wasser-Jahreszeit */
  thirst: number;
  /** zuletzt besuchte Felder (älteste zuerst) */
  trail: Pos[];
}

export interface PackState {
  id: number;
  x: number;
  y: number;
  size: number;
  /** gerissene Tiere, die noch nicht in Wachstum umgesetzt sind */
  fed: number;
  /** Monate ohne Beute */
  hungry: number;
}

export type Outcome = 'won' | 'lost';

export interface HerdeState {
  version: number;
  /** Seed der Partie (nur zur Anzeige; der laufende Zufall steht in `rng`) */
  seed: number;
  rng: number;
  island: string;
  /** vergangene Monate seit Spielbeginn (0 = erster Monat des ersten Jahres) */
  month: number;
  /** verbleibende Monate der Eiszeit (0 = keine Eiszeit) */
  ice: number;
  wild: number;
  over: Outcome | null;
  /** Felder Zeile für Zeile, Index = y * Breite + x */
  cells: CellState[];
  herd: HerdState;
  packs: PackState[];
  nextPackId: number;
  /** Karten-Ids auf der Hand */
  hand: string[];
}

/** Grund der Herdenwahl (Absicht), Reihenfolge der Prüfung wie im Prototyp. */
export type ReasonId = 'avoidWolves' | 'seekWater' | 'seekShelter' | 'freshGrass' | 'stay';

export type PackGoneCause = 'starved' | 'fire' | 'driven';

export type HerdeEvent =
  | { type: 'cardPlayed'; card: string; hand: number; x?: number; y?: number; wild: number }
  | { type: 'cardsDrawn'; cards: string[] }
  | { type: 'cellChanged'; x: number; y: number; from: string; to: string; cause: 'succession' | 'card' | 'fire' }
  /** Futter auf vielen Feldern auf einmal (z. B. Regen) */
  | { type: 'grassGrew'; card: string; amount: number; cells: number }
  /** Feuer: Blitz (Karte) oder Waldbrand (von selbst); `cells` in Reihenfolge des Übergreifens */
  | { type: 'fire'; cause: 'lightning' | 'wildfire'; x: number; y: number; cells: Pos[] }
  | { type: 'herdMoved'; from: Pos; to: Pos; reason: ReasonId }
  | { type: 'herdAte'; eaten: number; need: number; fat: number }
  | { type: 'herdStarved'; dead: number }
  | { type: 'herdThirsted'; dead: number }
  | { type: 'herdFroze'; dead: number }
  | { type: 'herdBurned'; dead: number }
  | { type: 'herdBorn'; born: number }
  | { type: 'wolvesHunted'; pack: number; killed: number }
  | { type: 'packMoved'; pack: number; from: Pos; to: Pos }
  | { type: 'packGrew'; pack: number; size: number }
  | { type: 'packFounded'; pack: number; parent: number; x: number; y: number }
  | { type: 'packStarved'; pack: number; size: number }
  | { type: 'packGone'; pack: number; x: number; y: number; cause: PackGoneCause }
  | { type: 'packImmigrated'; pack: number; x: number; y: number }
  | { type: 'seasonBegan'; season: string; month: number; year: number }
  | { type: 'iceAgeBegan'; months: number }
  | { type: 'iceAgeEnded'; survivors: number }
  | { type: 'gameWon'; survivors: number }
  | { type: 'gameLost'; month: number };

export type EventType = HerdeEvent['type'];
export type Emit = (e: HerdeEvent) => void;
