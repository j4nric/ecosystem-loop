import type { Locale } from '@core/api';
import { EngineClient } from './EngineClient.ts';
import type { GameClient } from './GameClient.ts';
import { loadGameData } from './gameData.ts';
import { MockClient } from './MockClient.ts';
import { LocalDeckStore, MemoryDeckStore, type DeckStore } from './DeckStore.ts';
import { LocalBookStore, LocalSaveStore, MemoryBookStore, MemorySaveStore } from './SaveStore.ts';

export type { BookView, GameClient, GameResult, Notice, PreviewView } from './GameClient.ts';
export type { BookStore, SavedGame, SaveStore } from './SaveStore.ts';
export type { DeckStore } from './DeckStore.ts';

/**
 * Die einzige Stelle, an der die Implementierung gewählt wird. Standard ist die echte Engine.
 * URL-Schalter zum Testen: `?mock` (Vorschau-Daten), `?seed=abc` (fester Seed für jede Partie), `?nosave` (nichts speichern).
 */
export function createGameClient(locale: Locale): { client: GameClient; decks: DeckStore } {
  const params = new URLSearchParams(window.location.search);
  const decks = params.has('nosave') || params.has('mock') ? new MemoryDeckStore() : new LocalDeckStore();
  if (params.has('mock')) return { client: new MockClient(locale), decks };
  const client = new EngineClient({
    data: loadGameData(),
    locale,
    store: params.has('nosave') ? new MemorySaveStore() : new LocalSaveStore(),
    books: params.has('nosave') ? new MemoryBookStore() : new LocalBookStore(),
    seed: params.get('seed') ?? undefined,
    deck: decks.load(),
  });
  return { client, decks };
}
