import type { Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { loadGameData } from './gameData.ts';
import { HerdeClient } from './HerdeClient.ts';
import type { GameClient } from './GameClient.ts';
import { LocalSaveStore, MemorySaveStore } from './SaveStore.ts';

export type { Fx, GameClient, LogEntry, Notice, PlayPreview, StartupNotice, StepReport } from './GameClient.ts';
export type { SavedGame, SaveStore } from './SaveStore.ts';

/**
 * Die einzige Stelle, an der der Client entsteht. URL-Schalter zum Testen: `?seed=abc` (fester Seed für jede
 * Partie), `?nosave` (nichts speichern).
 */
export function createGameClient(locale: Locale, strings: Strings): GameClient {
  const params = new URLSearchParams(window.location.search);
  return new HerdeClient({
    data: loadGameData(),
    locale,
    strings,
    store: params.has('nosave') ? new MemorySaveStore() : new LocalSaveStore(),
    seed: params.get('seed') ?? undefined,
  });
}
