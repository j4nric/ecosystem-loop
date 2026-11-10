/**
 * Kampagnen (Phase 6): mehrere Partien hintereinander mit Schöpfungsbuch. Der Bot wählt sein Startdeck aus dem
 * freigeschalteten Kartenpool. Gemessen wird die Wirkung der Freischaltungen: Partie k mit Buch gegenüber einer
 * Kontrollpartie mit gleichem Seed und Szenario, aber leerem Buch (Deck wie in Partie 1).
 */
import {
  cardPool,
  newBook,
  recordGame as recordBook,
  rngOf,
  seedFrom,
  type CreationBook,
  type GameData,
} from '@being-god/core';
import type { BotName } from './bots.ts';
import { recordGame, type GameRecord } from './metrics.ts';

/** Vorlieben beim Deckbau: Karten in dieser Reihenfolge, soweit im Pool (je 1 Kopie, höchstens maxSize). */
const PREFERENCES: Record<Exclude<BotName, 'random'>, string[]> = {
  greedy: [
    'thunderstorm',
    'drought',
    'storm',
    'frost',
    'rain',
    'sun',
    'seeds',
    'fertilizer',
    'healing',
    'silence',
    'ark',
    'balance',
  ],
  gardener: [
    'silence',
    'balance',
    'rain',
    'seeds',
    'fertilizer',
    'sun',
    'ark',
    'healing',
    'thunderstorm',
    'storm',
    'drought',
    'frost',
    'pollination',
    'seed_flight',
    'rain_call',
    'inspiration',
  ],
  evolver: [
    'storm',
    'thunderstorm',
    'ark',
    'balance',
    'rain',
    'seeds',
    'fertilizer',
    'sun',
    'silence',
    'pollination',
    'seed_flight',
    'drought',
    'healing',
    'frost',
    'blessing',
  ],
  disruptor: [
    'thunderstorm',
    'storm',
    'drought',
    'frost',
    'dry_wind',
    'ark',
    'rain',
    'seeds',
    'balance',
    'silence',
    'sun',
  ],
};

/** Startdeck eines Bots aus dem Kartenpool seines Schöpfungsbuchs. */
export function deckFor(data: GameData, bot: BotName, book: CreationBook, seed: string): string[] {
  const pool = cardPool(data, book);
  const { minSize, maxSize } = data.config.deck;
  if (bot === 'random')
    return rngOf({ rng: seedFrom(`deck:${seed}`) })
      .shuffle([...pool])
      .slice(0, maxSize);
  const deck = PREFERENCES[bot].filter((c) => pool.includes(c)).slice(0, maxSize);
  // Auffüllen bis zur Mindestgröße in Pool-Reihenfolge.
  for (const c of pool) if (deck.length < minSize && !deck.includes(c)) deck.push(c);
  return deck;
}

export interface CampaignOptions {
  bot: BotName;
  /** Anzahl Kampagnen. */
  campaigns: number;
  /** Partien je Kampagne. */
  games: number;
  seed: string;
  scenarios: string[];
  maxRounds: number;
}

export interface CampaignResult {
  /** games[k][c] = Partie k+1 der Kampagne c (mit Buch). */
  games: GameRecord[][];
  /** control[k][c] = gleiche Seeds/Szenario wie games[k][c], aber leeres Buch. */
  control: GameRecord[][];
  /** Freigeschaltete Karten im Pool vor Partie k+1 (Mittel über die Kampagnen). */
  poolSize: number[];
  /** Meilensteine: Anteil der Kampagnen, die ihn bis Partie k+1 erreicht haben. */
  milestones: Record<string, number[]>;
  /** Decks der letzten Partie (Häufigkeit je Karte über die Kampagnen). */
  lastDeck: Record<string, number>;
}

export function runCampaigns(data: GameData, o: CampaignOptions): CampaignResult {
  const games: GameRecord[][] = Array.from({ length: o.games }, () => []);
  const control: GameRecord[][] = Array.from({ length: o.games }, () => []);
  const poolSize = Array.from({ length: o.games }, () => 0);
  const milestones: Record<string, number[]> = Object.fromEntries(
    data.meta.milestones.map((m) => [m.id, Array.from({ length: o.games }, () => 0)]),
  );
  const lastDeck: Record<string, number> = {};
  for (let c = 0; c < o.campaigns; c++) {
    let book = newBook();
    for (let k = 0; k < o.games; k++) {
      const seed = `${o.seed}:c${c}:g${k}`;
      const scenario = o.scenarios[(c + k) % o.scenarios.length]!;
      poolSize[k]! += cardPool(data, book).length;
      const deck = deckFor(data, o.bot, book, seed);
      if (k === o.games - 1) for (const card of deck) lastDeck[card] = (lastDeck[card] ?? 0) + 1;
      const run = recordGame(data, { bot: o.bot, seed, scenario, maxRounds: o.maxRounds, deck, book });
      games[k]!.push(run.record);
      const empty = newBook();
      control[k]!.push(
        recordGame(data, {
          bot: o.bot,
          seed,
          scenario,
          maxRounds: o.maxRounds,
          deck: deckFor(data, o.bot, empty, seed),
          book: empty,
        }).record,
      );
      if (run.state && run.record.error === null) book = recordBook(data, book, run.state).book;
      for (const m of Object.keys(book.milestones)) milestones[m]![k]! += 1;
    }
  }
  // Summen in Mittelwerte bzw. Anteile umrechnen (erst am Ende, damit keine Rundungsfehler auflaufen).
  const avg = (v: number[]) => v.map((n) => Math.round((n / o.campaigns) * 1000) / 1000);
  return {
    games,
    control,
    poolSize: avg(poolSize),
    milestones: Object.fromEntries(Object.entries(milestones).map(([k, v]) => [k, avg(v)])),
    lastDeck,
  };
}
