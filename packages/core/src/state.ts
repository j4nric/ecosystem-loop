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
  /** Art-Id → Bestand (ab Phase 2). */
  populations: Record<string, number>;
}

export interface GameState {
  version: 2;
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
  | { type: 'collapsed'; round: number };

export type LevelReason = 'rise' | 'disturbance' | 'degraded' | 'formChanged';
