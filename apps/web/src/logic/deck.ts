import type { DeckIssue } from '@core/api';

/** Regeln für Startdecks aus `config.deck` (Größe, Kopien je Karte). */
export interface DeckRules {
  min: number;
  max: number;
  maxCopies: number;
}

/** Eine Karte des Pools für die Startdeck-Auswahl (lokalisierte Texte aus der Engine). */
export interface DeckCard {
  id: string;
  name: string;
  category: string;
  cost: number;
  /** Vollständiger Kartentext. */
  text: string;
  /** Kurztext (≤ ~40 Zeichen). */
  short: string;
}

/** Alles, was die Startdeck-Auswahl braucht: Pool (Reihenfolge der Daten), Standarddeck und Regeln. */
export interface DeckSetup {
  pool: DeckCard[];
  standard: string[];
  rules: DeckRules;
}

/** Anzahl der Kopien einer Karte im Deck. */
export function copies(deck: readonly string[], id: string): number {
  return deck.filter((c) => c === id).length;
}

/** Darf eine weitere Kopie hinein? (Deck nicht voll, Kopien-Grenze nicht erreicht.) */
export function canAdd(deck: readonly string[], id: string, rules: DeckRules): boolean {
  return deck.length < rules.max && copies(deck, id) < rules.maxCopies;
}

/** Fügt eine Kopie hinzu, wenn erlaubt; sonst bleibt das Deck unverändert (gleiche Referenz). */
export function addCard(deck: readonly string[], id: string, rules: DeckRules): readonly string[] {
  return canAdd(deck, id, rules) ? [...deck, id] : deck;
}

/** Entfernt eine Kopie (die letzte); ohne Kopie bleibt das Deck unverändert (gleiche Referenz). */
export function removeCard(deck: readonly string[], id: string): readonly string[] {
  const at = deck.lastIndexOf(id);
  return at < 0 ? deck : [...deck.slice(0, at), ...deck.slice(at + 1)];
}

/** Sortiert ein Deck nach der Pool-Reihenfolge (unbekannte Karten zuletzt, stabil). */
export function sortDeck(deck: readonly string[], order: readonly string[]): string[] {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  return [...deck].sort((a, b) => rank(a) - rank(b));
}

/** Gleiche Karten in gleicher Anzahl (Reihenfolge egal)? */
export function sameDeck(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((c, i) => c === y[i]);
}

/** Gespeichertes Deck lesen: nur eine Liste aus Texten mit plausibler Länge, sonst null. */
export function parseStoredDeck(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;
  return raw.every((c): c is string => typeof c === 'string' && c.length > 0) ? [...raw] : null;
}

/**
 * Deck, mit dem die Auswahl beginnt: das gemerkte, wenn es laut Engine (noch) gültig ist, sonst das Standarddeck.
 * `issues` ist die Prüfung der Engine (`validateDeck` über den Client).
 */
export function initialDeck(
  stored: readonly string[] | null,
  standard: readonly string[],
  issues: (deck: string[]) => readonly DeckIssue[],
): string[] {
  if (stored && issues([...stored]).length === 0) return [...stored];
  return [...standard];
}

/** Satzbausteine für Deck-Probleme (aus der Übersetzungsdatei). */
export interface DeckIssueStrings {
  deckSize: (count: number, min: number, max: number) => string;
  deckCopies: (name: string, count: number, max: number) => string;
  deckUnknown: (name: string) => string;
  deckLocked: (name: string) => string;
}

/** Lesbarer, lokalisierter Text zu einem Problem aus `validateDeck` (mit Kartennamen statt Ids). */
export function deckIssueMessage(issue: DeckIssue, s: DeckIssueStrings, nameOf: (id: string) => string): string {
  switch (issue.code) {
    case 'size':
      return s.deckSize(issue.count, issue.min, issue.max);
    case 'copies':
      return s.deckCopies(nameOf(issue.card), issue.count, issue.max);
    case 'unknown':
      return s.deckUnknown(nameOf(issue.card));
    case 'locked':
      return s.deckLocked(nameOf(issue.card));
  }
}
