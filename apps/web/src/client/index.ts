import type { Locale } from '@core/api';
import type { GameClient } from './GameClient.ts';
import { MockClient } from './MockClient.ts';

export type { GameClient } from './GameClient.ts';

/**
 * Die einzige Stelle, an der die Implementierung gewählt wird.
 * Sobald die Engine v2 steht: `return new EngineClient(locale);`
 */
export function createGameClient(locale: Locale): GameClient {
  return new MockClient(locale);
}
