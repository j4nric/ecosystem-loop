/**
 * Spielzustand einer Expedition. Reine Daten (JSON-serialisierbar, per structuredClone klonbar).
 */
import type { Stat, Values } from './schema.ts';

export interface CardInstance {
  uid: number;
  card: string;
}

export interface AnimalPresence {
  id: string;
  arrivedTurn: number;
  /** Aufeinanderfolgende Zugenden, an denen ein Fresser dieser Art in derselben Zone war. */
  withPredatorTurns: number;
}

export interface ZoneState {
  id: string;
  type: string;
  values: Values;
  neighbors: string[];
  tags: string[];
  animals: AnimalPresence[];
  /** Zug der letzten Störung in dieser Zone (0 = Expeditionsbeginn). */
  lastDisturbanceTurn: number;
  /** Tier-Id → Anzahl Zugenden in Folge, an denen seine Bedingungen erfüllt waren (für Einzugsverzögerung). */
  pending: Record<string, number>;
}

export type EndReason = 'voluntary' | 'deckEmpty' | 'maxTurns';

export interface ExpeditionState {
  rng: number;
  scenario: string;
  turn: number;
  phase: 'play' | 'ended';
  endReason: EndReason | null;
  zones: ZoneState[];
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  nextUid: number;
  playsThisTurn: number;
  /** Karten-Id → wie oft in dieser Expedition gespielt. */
  cardPlays: Record<string, number>;
  /** Arten, die in dieser Expedition mindestens einmal eingezogen sind. */
  arrivedSpecies: string[];
  log: GameEvent[];
}

/** Gewählte Ziele einer Karte: Slot-Id → Zonen-Id, Tier-Id oder Karten-uid (als Text). */
export type Choices = Record<string, string>;

export type GameEvent =
  | { type: 'turnStarted'; turn: number }
  | { type: 'cardDrawn'; card: string }
  | { type: 'cardPlayed'; card: string; choices: Choices }
  | { type: 'triggered'; card: string; trigger: string; zone: string; disturbance: boolean }
  | { type: 'valueChanged'; zone: string; stat: Stat; from: number; to: number }
  | { type: 'tagAdded'; zone: string; tag: string }
  | { type: 'tagRemoved'; zone: string; tag: string }
  | { type: 'zonesConnected'; a: string; b: string }
  | { type: 'animalMoved'; animal: string; from: string; to: string }
  | { type: 'cardDiscarded'; card: string }
  | { type: 'zoneTypeChanged'; zone: string; from: string; to: string }
  | { type: 'animalEaten'; prey: string; predators: string[]; zone: string }
  | { type: 'animalLeft'; animal: string; zone: string }
  | { type: 'animalArrived'; animal: string; zone: string; cardAdded: string | null }
  | { type: 'expeditionEnded'; reason: EndReason };
