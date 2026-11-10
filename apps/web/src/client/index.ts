import type { Locale } from '@core/api';
import { EngineClient } from './EngineClient.ts';
import type { GameClient } from './GameClient.ts';
import { loadGameData } from './gameData.ts';
import { MockClient } from './MockClient.ts';
import { LocalSaveStore, MemorySaveStore } from './SaveStore.ts';

export type { GameClient, Notice, PreviewView } from './GameClient.ts';
export type { SavedGame, SaveStore } from './SaveStore.ts';

/**
 * Die einzige Stelle, an der die Implementierung gewählt wird. Standard ist die echte Engine.
 * URL-Schalter zum Testen: `?mock` (Vorschau-Daten), `?seed=abc` (fester Seed), `?nosave` (nichts speichern).
 */
export function createGameClient(locale: Locale): GameClient {
  const params = new URLSearchParams(window.location.search);
  if (params.has('mock')) return new MockClient(locale);
  return new EngineClient({
    data: loadGameData(),
    locale,
    store: params.has('nosave') ? new MemorySaveStore() : new LocalSaveStore(),
    seed: params.get('seed') ?? undefined,
  });
}
