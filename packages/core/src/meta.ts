/**
 * Meta-Progression (Konzept 10): Schöpfungsbuch, Kartenpool für Startdecks, Deckprüfung, Welt des Tages.
 * Alles rein: Das Buch ist JSON, jede Funktion liefert ein neues Buch statt das alte zu verändern.
 */
import { z } from 'zod';
import type { BookUpdate, CreationBook, DeckIssue } from './api.ts';
import type { BookStat, GameData } from './schema/index.ts';
import type { GameState } from './state.ts';

/** Leeres Schöpfungsbuch vor der ersten Partie. */
export function newBook(): CreationBook {
  return {
    version: 1,
    games: 0,
    species: {},
    milestones: {},
    totals: { rounds: 0, extinctions: 0, events: 0 },
    best: { score: 0, rounds: 0, tier: 0 },
  };
}

const Count = z.number().int().nonnegative();
const BookSchema = z.strictObject({
  version: z.literal(1),
  games: Count,
  species: z.record(z.string(), z.strictObject({ firstGame: Count, firstRound: Count })),
  milestones: z.record(z.string(), z.strictObject({ game: Count })),
  totals: z.strictObject({ rounds: Count, extinctions: Count, events: Count }),
  best: z.strictObject({ score: z.number(), rounds: Count, tier: Count }),
});

/** Prüft ein geladenes Buch (z. B. aus dem Speicher der App); null, wenn es kein gültiges Buch ist. */
export function parseBook(raw: unknown): CreationBook | null {
  const r = BookSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Kennzahl des Buchs für Meilensteine. */
export function bookStat(book: CreationBook, stat: BookStat): number {
  switch (stat) {
    case 'games':
      return book.games;
    case 'discovered':
      return Object.keys(book.species).length;
    case 'extinctions':
      return book.totals.extinctions;
    case 'events':
      return book.totals.events;
    case 'rounds':
      return book.totals.rounds;
    case 'bestScore':
      return book.best.score;
    case 'bestRounds':
      return book.best.rounds;
    case 'bestTier':
      return book.best.tier;
  }
}

/**
 * Kartenpool für Startdecks: Grundpool + Gaben entdeckter Arten + Freischaltungen erreichter Meilensteine,
 * in Daten-Reihenfolge der Karten, ohne Doppelte.
 */
export function cardPool(data: GameData, book: CreationBook): string[] {
  const ids = new Set(data.meta.basePool);
  for (const id of Object.keys(book.species)) for (const c of data.species.get(id)?.gift ?? []) ids.add(c);
  for (const m of data.meta.milestones) if (m.id in book.milestones) for (const c of m.unlocks) ids.add(c);
  return [...data.cards.keys()].filter((c) => ids.has(c));
}

/**
 * Prüft ein Startdeck: Größe (config.deck), höchstens maxCopies Kopien je Karte, nur bekannte Karten und –
 * mit Buch – nur Karten aus dem Pool. Leere Liste = gültig.
 */
export function validateDeck(data: GameData, book: CreationBook | null, deck: readonly string[]): DeckIssue[] {
  const { minSize: min, maxSize: max, maxCopies } = data.config.deck;
  const issues: DeckIssue[] = [];
  if (deck.length < min || deck.length > max) issues.push({ code: 'size', count: deck.length, min, max });
  const pool = book ? new Set(cardPool(data, book)) : null;
  for (const card of new Set(deck)) {
    const count = deck.filter((c) => c === card).length;
    if (!data.cards.has(card)) issues.push({ code: 'unknown', card });
    else if (pool && !pool.has(card)) issues.push({ code: 'locked', card });
    if (count > maxCopies) issues.push({ code: 'copies', card, count, max: maxCopies });
  }
  return issues;
}

/** Deutsche Kurzbeschreibung eines Deck-Problems (für Fehlermeldungen der Engine). */
export function deckIssueText(i: DeckIssue): string {
  switch (i.code) {
    case 'size':
      return `Deck mit ${i.count} Karten, erlaubt ${i.min}–${i.max}.`;
    case 'copies':
      return `${i.card} ${i.count}× im Deck, erlaubt ${i.max}.`;
    case 'unknown':
      return `Unbekannte Karte im Deck: ${i.card}`;
    case 'locked':
      return `Karte noch nicht freigeschaltet: ${i.card}`;
  }
}

/** Höchste Stufe aller Arten, die in dieser Partie gelebt haben. */
function highestTier(data: GameData, state: GameState): number {
  return Math.max(0, ...Object.keys(state.species).map((id) => data.species.get(id)?.tier ?? 0));
}

/**
 * Trägt eine Partie ins Schöpfungsbuch ein (Konzept 10): entdeckte Arten (auch das Startleben), Summen,
 * Bestwerte und neu erreichte Meilensteine. Das übergebene Buch bleibt unverändert.
 */
export function recordGame(data: GameData, book: CreationBook, finalState: GameState): BookUpdate {
  const next = structuredClone(book);
  const poolBefore = new Set(cardPool(data, book));
  next.games++;
  const discovered: string[] = [];
  for (const [id, rec] of Object.entries(finalState.species))
    if (!(id in next.species)) {
      next.species[id] = { firstGame: next.games, firstRound: rec.since };
      discovered.push(id);
    }
  next.totals.rounds += finalState.round;
  next.totals.extinctions += finalState.extinctions.length;
  next.totals.events += finalState.eventsOccurred;
  const records: BookUpdate['records'] = [];
  const tier = highestTier(data, finalState);
  if (finalState.score > next.best.score) {
    next.best.score = finalState.score;
    records.push('score');
  }
  if (finalState.round > next.best.rounds) {
    next.best.rounds = finalState.round;
    records.push('rounds');
  }
  if (tier > next.best.tier) {
    next.best.tier = tier;
    records.push('tier');
  }
  const milestones: string[] = [];
  for (const m of data.meta.milestones)
    if (!(m.id in next.milestones) && m.when.every((c) => bookStat(next, c.stat) >= c.gte)) {
      next.milestones[m.id] = { game: next.games };
      milestones.push(m.id);
    }
  const unlocked = cardPool(data, next).filter((c) => !poolBefore.has(c));
  return { book: next, discovered, milestones, unlocked, records };
}

/** Seed der Welt des Tages (UTC-Datum), z. B. "daily-2026-11-10". Rein: gleiche Eingabe, gleicher Seed. */
export function dailySeed(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `daily-${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}
