/**
 * Spielzustand (reines JSON, klonbar mit structuredClone) und Ereignisse.
 * Ereignisse tragen nur Ids und Zahlen; Texte entstehen erst in der Oberfläche.
 */

/** Version des Zustandsformats; bei inkompatiblen Änderungen erhöhen (validateState lehnt alte Stände ab). */
export const STATE_VERSION = 4;

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
  /** Merkmale (traits.yaml) in der Reihenfolge der Wahl; ihre Wirkung bleibt über den Stufensprung */
  traits: string[];
  /**
   * Zahl der Merkmale beim Erreichen der aktuellen Stufe: `traits` ab diesem Index wurden auf der aktuellen Stufe
   * gewählt (zählen für die Reife bei `mature.scope: stage`).
   */
  traitsAtStage: number;
  /** Zähler des Erlebten je Erfahrung (traits.yaml → experiences) */
  experience: Record<string, number>;
  /** angebotene Merkmale (leer = kein Angebot) */
  offer: string[];
  /** wie oft ein Angebot seit der letzten Wahl liegen geblieben ist (Rotation des Angebots, ohne Zufall) */
  offerTurn: number;
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

/** Ein Wildbestand (Beutetiere, Konzept 9.2): ohne Kampf, wächst bei Futter, zieht, verhungert. */
export interface PreyState {
  id: number;
  x: number;
  y: number;
  /** Größe des Bestands (1 … prey.maxSize) */
  size: number;
  /** satte Monate in Folge (Wachstum bei prey.fedToGrow) */
  fed: number;
  /** hungrige Monate (Schrumpfen bei prey.starveAfter) */
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
  /** Wildbestände */
  prey: PreyState[];
  nextPreyId: number;
  /** Lager der Herde (Stufe mit `camp`, nach `settle`); die Herde steht darauf und zieht nicht mehr */
  camp: Pos | null;
  /** überstandene Eiszeiten */
  iceAges: number;
  /** Karten-Ids auf der Hand */
  hand: string[];
}

/** Grund der Herdenwahl (Absicht), Reihenfolge der Prüfung wie im Prototyp. */
export type ReasonId = 'avoidWolves' | 'seekWater' | 'seekShelter' | 'freshGrass' | 'stay' | 'settled';

export type PackGoneCause = 'starved' | 'fire' | 'driven';

/** Ursache eines Landschaftswandels */
export type ChangeCause = 'succession' | 'card' | 'fire' | 'clearing';

export type HerdeEvent =
  | { type: 'cardPlayed'; card: string; hand: number; x?: number; y?: number; wild: number }
  | { type: 'cardsDrawn'; cards: string[] }
  | { type: 'cellChanged'; x: number; y: number; from: string; to: string; cause: ChangeCause }
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
  /** Zu Beginn einer Jahreszeit: neues oder erneuertes Angebot an Merkmalen */
  | { type: 'traitOffered'; traits: string[] }
  | { type: 'traitPicked'; trait: string }
  /** Die Herde ist reif für die nächste Stufe (nach einer Wahl) */
  | { type: 'matured'; stage: string; next: string }
  | { type: 'herdEvolved'; from: string; to: string }
  /** Eiszeit überstanden; `count`: so viele Eiszeiten hat die Herde jetzt überstanden */
  | { type: 'iceAgeEnded'; survivors: number; count: number }
  | { type: 'gameWon'; survivors: number }
  /** extinct: die Herde ist ausgestorben · lastIce: die letzte Eiszeit (ice.ages) ohne Lager als Mensch überstanden */
  | { type: 'gameLost'; month: number; cause: 'extinct' | 'lastIce' }
  // Wild
  | { type: 'preyGrew'; prey: number; size: number }
  | { type: 'preyFounded'; prey: number; parent: number; x: number; y: number }
  | { type: 'preyMoved'; prey: number; from: Pos; to: Pos }
  /** hungrig geschrumpft; `size` danach (0 = verschwunden) */
  | { type: 'preyStarved'; prey: number; size: number }
  /** Feld unbegehbar geworden, kein Ausweichen möglich */
  | { type: 'preyGone'; prey: number; x: number; y: number }
  | { type: 'preyImmigrated'; prey: number; x: number; y: number; size: number }
  /** die Herde hat gejagt; `size` danach (0 = verschwunden); `fire`: Feuer hat das Wild aufgetrieben */
  | { type: 'preyHunted'; prey: number; killed: number; size: number; fire: boolean }
  /** ein Rudel hat Wild gerissen (statt der Herde); `size` danach */
  | { type: 'packAtePrey'; pack: number; prey: number; killed: number; size: number }
  // Lager
  | { type: 'campFounded'; x: number; y: number }
  | { type: 'fieldCleared'; x: number; y: number; from: string; to: string };

export type EventType = HerdeEvent['type'];
export type Emit = (e: HerdeEvent) => void;
