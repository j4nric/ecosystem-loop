/**
 * Öffentliche Schnittstelle der Engine v2 – der Vertrag zwischen Engine, Oberflächen (Web-App, Konsole)
 * und Bots. Nur Typen; die Implementierung liegt in `game.ts`.
 *
 * Grundsätze:
 * - Oberflächen lesen nur `GameView` und schicken nur `Action`s. Sie greifen nie in `GameState` ein.
 * - `step` ist rein: gleicher Zustand + gleiche Aktion ⇒ gleiches Ergebnis (Zufall über den Seed im Zustand).
 * - Alle Texte kommen lokalisiert aus den Daten (`Text`), die Engine liefert IDs und Ereignisse.
 *
 * Änderungen an diesen Typen sind Schnittstellenänderungen: App und Konsole müssen mitgezogen werden.
 */

/** Sprachcode für Texte aus den Daten. */
export type Locale = 'de' | 'en';

/** Startparameter einer Partie. */
export interface GameSetup {
  seed: string | number;
  /** Szenario-Id aus `scenarios.yaml`; Standard: "standard". */
  scenario?: string;
  /**
   * Karten-Ids des Startdecks; Standard: `config.starterDeck`. Wird mit `validateDeck` geprüft
   * (Größe, Kopien; mit `book` zusätzlich nur Karten aus dem freigeschalteten Pool).
   */
  deck?: string[];
  /** Schöpfungsbuch des Spielers: begrenzt das Startdeck auf `cardPool(data, book)` (ab Phase 3). */
  book?: CreationBook;
  /** Variierte Startwelt aus dem Seed (Streuung: config.startWorld.spread); Standard: config.startWorld.vary. */
  vary?: boolean;
}

/** Ziele einer Karte: Slot-Id → Zonen-Id, Art-Id oder Karten-uid (als Text). */
export type Targets = Record<string, string>;

export type Action =
  | { type: 'play'; uid: number; targets: Targets }
  /** Eingriffe beenden: die Natur-Phase läuft, danach beginnt die nächste Runde. */
  | { type: 'endTurn' };

/** Ein legaler Kartenzug. */
export interface Play {
  uid: number;
  card: string;
  targets: Targets;
}

export type FormKind = 'ideal' | 'normal' | 'degraded' | 'disturbance';

export interface StatView {
  id: string;
  name: string;
  value: number;
  max: number;
}

export interface ZoneView {
  id: string;
  geography: string;
  geographyName: string;
  /** Licht, Feuchte, Vegetation und der Sonderwert der Geografie, in dieser Reihenfolge. */
  stats: StatView[];
  form: { id: string; name: string; kind: FormKind };
  /** Zonenstufe 1–5 und Fortschritt zur nächsten Stufe (0–1). */
  level: number;
  levelProgress: number;
  neighbors: string[];
  tags: string[];
  /** Bestände der Arten in dieser Zone (ab Phase 2). */
  populations: { species: string; name: string; tier: number; count: number }[];
  /** Sichtbare Gefahren: Schwellen von Handkarten, die hier auslösen würden (z. B. 🔥). */
  warnings: { card: string; trigger: string; name: string; icon: string }[];
}

export interface CardView {
  uid: number;
  card: string;
  name: string;
  /** Kategorie aus den Daten, z. B. "force", "gift", "miracle", "species", "human". */
  category: string;
  cost: number;
  /** Lesbarer Kartentext in der gewählten Sprache. */
  text: string;
  playable: boolean;
  /**
   * Ziel-Slots in Reihenfolge, damit die Oberfläche die Auswahl führen kann.
   * of = bezogener früherer Slot (neighbor: dessen Nachbar, species: Art in dessen Zone).
   * options = Wahlmöglichkeiten eines choice-Slots (Wert = Options-Id).
   */
  slots: { id: string; kind: string; label: string; of?: string; options?: { id: string; label: string }[] }[];
}

export interface GameView {
  locale: Locale;
  round: number;
  year: number;
  season: { id: string; name: string };
  /** "play" = Eingriffe möglich, "over" = Kollaps. */
  phase: 'play' | 'over';
  harmony: { value: number; max: number; trend: number };
  breath: { value: number; max: number; nextIncome: number };
  score: number;
  zones: ZoneView[];
  hand: CardView[];
  drawPile: number;
  discardPile: number;
  playsThisTurn: number;
  minPlays: number;
  canEndTurn: boolean;
  /**
   * Angekündigtes Ereignis (ab Phase 3). Es tritt in der Natur-Phase dieser Runde ein (inRounds 0),
   * verschoben entsprechend später. zone/zoneName: ausgeloste Zielzone, falls bekannt.
   */
  forecast: {
    id: string;
    name: string;
    text: string;
    icon?: string;
    zone?: string | null;
    zoneName?: string | null;
    strength?: number;
    inRounds?: number;
  } | null;
  /** So viele der nächsten Ereignisse entfallen bereits (vorab gespielte Stille). */
  eventShield?: number;
  /** Arten, die je gelebt haben, und die höchste erreichte Stufe (ab Phase 2). */
  highestTier: number;
}

/** Vorschau eines Kartenzugs ohne Ausführung (für Ziehen-und-Loslassen in der App). */
export interface Preview {
  cost: number;
  affordable: boolean;
  /** Erwartete Wertänderungen je Zone durch die Karte selbst (ohne Natur-Phase). */
  changes: { zone: string; stat: string; from: number; to: number; zoneName?: string; statName?: string }[];
  /** Schwellen, die auslösen würden. */
  triggers: { zone: string; trigger: string; name: string; icon: string; zoneName?: string }[];
  /** Formwechsel, die sich aus den neuen Werten ergeben würden (Namen und Art der neuen Form lokalisiert). */
  formChanges: {
    zone: string;
    from: string;
    to: string;
    zoneName?: string;
    fromName?: string;
    toName?: string;
    kind?: FormKind;
  }[];
  /** Bestandsänderungen durch die Karte (ab Phase 3 gefüllt). */
  populationChanges?: {
    zone: string;
    zoneName: string;
    species: string;
    speciesName: string;
    from: number;
    to: number;
  }[];
  /** Wirkung auf das angekündigte Ereignis (Gegenkarten). */
  /** shielded = kein Ereignis angekündigt; das nächste ausgeloste entfällt (event/name dann null). */
  eventChanges?: {
    event: string | null;
    name: string | null;
    change: 'cancelled' | 'delayed' | 'shielded';
    round?: number;
  }[];
}

/**
 * Schöpfungsbuch (Konzept 10): bleibt zwischen Partien erhalten, reines JSON. Die Oberfläche speichert es,
 * die Engine trägt mit `recordGame` ein und leitet daraus `cardPool` ab.
 */
export interface CreationBook {
  version: 1;
  /** Anzahl eingetragener Partien. */
  games: number;
  /** Entdeckte Arten: Nummer der Partie und Runde, in der sie erstmals gelebt haben. */
  species: Record<string, { firstGame: number; firstRound: number }>;
  /** Erreichte Meilensteine mit der Partie, in der sie erreicht wurden. */
  milestones: Record<string, { game: number }>;
  /** Summen über alle Partien. */
  totals: { rounds: number; extinctions: number; events: number };
  /** Bestwerte einer Partie. */
  best: { score: number; rounds: number; tier: number };
}

/** Ergebnis von `recordGame`: neues Buch und was diese Partie neu gebracht hat. */
export interface BookUpdate {
  book: CreationBook;
  /** Erstmals entdeckte Arten. */
  discovered: string[];
  /** Neu erreichte Meilensteine. */
  milestones: string[];
  /** Karten, die neu in den Pool gekommen sind. */
  unlocked: string[];
  /** Neue Bestwerte. */
  records: ('score' | 'rounds' | 'tier')[];
}

/** Problem eines Startdecks (leer = gültig). */
export type DeckIssue =
  | { code: 'size'; count: number; min: number; max: number }
  | { code: 'copies'; card: string; count: number; max: number }
  | { code: 'unknown'; card: string }
  | { code: 'locked'; card: string };
