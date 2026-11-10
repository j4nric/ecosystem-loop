/**
 * Spielzustand der Engine v2. Reine Daten (JSON-serialisierbar, per structuredClone klonbar).
 * Oberflächen lesen den Zustand nie direkt, sondern über `view()`.
 */
import type { Targets } from './api.ts';

export interface CardInstance {
  uid: number;
  card: string;
}

export interface ZoneState {
  id: string;
  geography: string;
  /** Wert-Id → Wert. Enthält genau die gemeinsamen Werte und den Sonderwert der Geografie. */
  stats: Record<string, number>;
  neighbors: string[];
  tags: string[];
  /** Aktuelle Form (wird in der Natur-Phase bestimmt). */
  form: string;
  /** Runde, in der die aktuelle Form begonnen hat (0 = Spielbeginn). */
  formSince: number;
  /** Zonenstufe und Runden in Folge, die zum nächsten Aufstieg zählen. */
  level: number;
  levelProgress: number;
  /** Runde der letzten Störung (Feuer, Flut, Baumsturz, Hochwasser …), null = nie. */
  lastDisturbance: number | null;
  /** Art-Id → Bestand 0–9. */
  populations: Record<string, number>;
  /** Runde des letzten Hungers bzw. der letzten Überpopulation in dieser Zone, null = nie. */
  lastHunger: number | null;
  /** Neue Art-Id → Runden in Folge, in denen ihre Evolutionsbedingungen hier erfüllt waren. */
  evolution: Record<string, number>;
}

/** Lebenslauf einer Art in dieser Partie. */
export interface SpeciesRecord {
  /** Runde, in der die Art erstmals gelebt hat (0 = Startleben). */
  since: number;
  /** Runde des Aussterbens; null = lebt (oder ist zurückgekehrt). */
  extinct: number | null;
}

/** Version des Zustandsformats; Spielstände anderer Versionen sind nicht ladbar. */
export const STATE_VERSION = 4;

export interface GameState {
  version: typeof STATE_VERSION;
  rng: number;
  scenario: string;
  round: number;
  phase: 'play' | 'over';
  harmony: number;
  /** Veränderung der Harmonie in der letzten Bilanz. */
  harmonyTrend: number;
  breath: number;
  zones: ZoneState[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  nextUid: number;
  playsThisTurn: number;
  /** Karten-Id → wie oft in dieser Partie gespielt. */
  cardPlays: Record<string, number>;
  /** Arten, die in dieser Partie je gelebt haben. */
  species: Record<string, SpeciesRecord>;
  /** Punkte (Konzept 10). */
  score: number;
  /** Jedes Aussterben dieser Partie (eine Art kann mehrmals aussterben). Grundlage für Harmonie und Meilensteine. */
  extinctions: { species: string; round: number }[];
  /** Angekündigtes Ereignis (Konzept 9); tritt in der Natur-Phase der Runde `round` ein. */
  forecast: ForecastState | null;
  /** So viele der nächsten ausgelosten Ereignisse entfallen (Stille ohne angekündigtes Ereignis). */
  eventShield: number;
  /** Eingetretene Ereignisse dieser Partie. */
  eventsOccurred: number;
}

export interface ForecastState {
  event: string;
  /** Runde, in deren Natur-Phase das Ereignis eintritt. */
  round: number;
  /** Stärke-Faktor (Skalierung über die Jahre). */
  strength: number;
  /** Beim Ankündigen ausgeloste Zielzone (pick: random), sonst null. */
  zone: string | null;
}

/** Ereignisse eines Schritts. Texte entstehen erst in der Oberfläche. */
export type GameEvent =
  | { type: 'roundStarted'; round: number; season: string }
  | { type: 'cardDrawn'; uid: number; card: string }
  | { type: 'deckReshuffled'; cards: number }
  | { type: 'cardPlayed'; uid: number; card: string; targets: Targets; cost: number }
  | { type: 'triggered'; card: string; trigger: string; zone: string; disturbance: boolean }
  | { type: 'disturbance'; zone: string; cause: string }
  | { type: 'statChanged'; zone: string; stat: string; from: number; to: number; cause: string }
  | { type: 'breathChanged'; from: number; to: number; cause: string }
  | { type: 'turnEnded'; round: number }
  | { type: 'seasonApplied'; season: string }
  | { type: 'couplingApplied'; coupling: string; from: string; to: string }
  | { type: 'formChanged'; zone: string; from: string; to: string }
  | { type: 'levelChanged'; zone: string; from: number; to: number; reason: LevelReason }
  | {
      type: 'harmonyChanged';
      from: number;
      to: number;
      parts: { source: string; zone: string | null; amount: number }[];
    }
  | { type: 'collapsed'; round: number }
  /**
   * Die Partie ist vorbei (letztes Ereignis eines Schritts, der zum Kollaps führt): letzte Runde und
   * Endpunktzahl. Oberflächen rufen daraufhin genau einmal `recordGame` mit dem Zustand des Schritts auf.
   */
  | { type: 'gameOver'; round: number; score: number }
  /** Bestand einer Art in einer Zone hat sich geändert. cause: growth, hunger, degraded, overhunted, hunted,
   *  migration, evolution oder card:<id> bzw. trigger:<id>. */
  | { type: 'populationChanged'; zone: string; species: string; from: number; to: number; cause: string }
  /** Eine Art hat in dieser Zone nicht genug Nahrung. */
  | { type: 'hunger'; zone: string; species: string }
  /** Die Nachfrage übersteigt eine Nahrungsquelle (Wert- oder Art-Id); sie wird leergefressen. */
  | { type: 'overpopulation'; zone: string; food: string }
  /** Tiere sind in eine Nachbarzone gewandert. */
  | { type: 'migrated'; species: string; from: string; to: string; count: number }
  /** Evolution: aus `ancestor` in Zone `from` sind Tiere der Art `species` in Zone `zone` entstanden.
   *  first = erstmals in dieser Partie. */
  | { type: 'speciesEmerged'; species: string; ancestor: string; from: string; zone: string; first: boolean }
  /** Eine Art lebt in keiner Zone mehr. */
  | { type: 'speciesExtinct'; species: string }
  /** Die Gabe einer Art kam als Karte in den Nachziehstapel. */
  | { type: 'giftAdded'; species: string; card: string; uid: number }
  /** Punkte der Runde (Konzept 10). */
  | { type: 'scored'; points: number; total: number; doubled: boolean }
  /** Ein Ereignis wurde für die Natur-Phase der Runde `round` angekündigt (Konzept 9). */
  | { type: 'eventForecast'; event: string; round: number; zone: string | null; strength: number }
  /** Das angekündigte Ereignis ist eingetreten. zone = Zielzone (falls das Ereignis eine hat). */
  | { type: 'eventOccurred'; event: string; zone: string | null; strength: number }
  /** Ein Ereignis entfällt. cause: card:<id> (Gegenkarte) oder shield (vorab gespielte Stille). */
  | { type: 'eventCancelled'; event: string; cause: string }
  /** Ein Ereignis wurde verschoben und tritt jetzt in Runde `round` ein. */
  | { type: 'eventDelayed'; event: string; round: number; cause: string };

/** effect = durch einen Effekt gesetzt (z. B. Meteorit). */
export type LevelReason = 'rise' | 'disturbance' | 'degraded' | 'formChanged' | 'effect';
