/**
 * Progression über Expeditionen: Feldnotizen (Notizbuch), Kartenpool und Startdeck.
 * Progression bedeutet früheren Zugang, nicht mehr Macht.
 */
import { report } from './engine.ts';
import type { GameData } from './schema.ts';
import type { ExpeditionState } from './state.ts';

export interface NotebookEntry {
  /** Nummer der Expedition, in der das Tier erstmals dokumentiert wurde (1-basiert). */
  firstExpedition: number;
  timesDocumented: number;
}

export interface Notebook {
  version: 1;
  expeditions: number;
  entries: Record<string, NotebookEntry>;
}

export function emptyNotebook(): Notebook {
  return { version: 1, expeditions: 0, entries: {} };
}

export function isDiscovered(nb: Notebook, animal: string): boolean {
  return animal in nb.entries;
}

/** Karten, aus denen ein Startdeck gebaut werden darf. */
export function cardPool(data: GameData, nb: Notebook): string[] {
  const base = [...data.cards.values()].filter((c) => c.source === 'base').map((c) => c.id);
  const unlocked = Object.keys(nb.entries)
    .map((a) => data.animals.get(a)?.card)
    .filter((c): c is string => !!c);
  return [...new Set([...base, ...unlocked])];
}

/** Liefert Fehlermeldungen; leer = Deck ist gültig. */
export function validateDeck(data: GameData, nb: Notebook, deck: readonly string[]): string[] {
  const { minSize, maxSize, maxCopiesPerCard } = data.config.deck;
  const problems: string[] = [];
  if (deck.length < minSize || deck.length > maxSize)
    problems.push(`Deck hat ${deck.length} Karten, erlaubt sind ${minSize}–${maxSize}.`);
  const pool = new Set(cardPool(data, nb));
  const counts = new Map<string, number>();
  for (const c of deck) {
    if (!pool.has(c)) problems.push(`Karte ${c} ist nicht freigeschaltet.`);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const [c, n] of counts)
    if (n > maxCopiesPerCard) problems.push(`Karte ${c}: ${n} Kopien, erlaubt ${maxCopiesPerCard}.`);
  return problems;
}

/**
 * Trägt das Ergebnis einer beendeten Expedition ins Notizbuch ein (verändert nb).
 * Gibt die neu entdeckten Arten zurück.
 */
export function recordExpedition(data: GameData, nb: Notebook, state: ExpeditionState): string[] {
  if (state.phase !== 'ended') throw new Error('Expedition läuft noch.');
  nb.expeditions++;
  const documented = data.config.notebook.recordOn === 'end' ? report(data, state).species : state.arrivedSpecies;
  const fresh: string[] = [];
  for (const a of documented) {
    const e = nb.entries[a];
    if (e) e.timesDocumented++;
    else {
      nb.entries[a] = { firstExpedition: nb.expeditions, timesDocumented: 1 };
      fresh.push(a);
    }
  }
  return fresh;
}
