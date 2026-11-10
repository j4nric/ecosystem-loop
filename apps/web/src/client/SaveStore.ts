import { STATE_VERSION, type GameState } from '@being-god/core';

/** Ein gespeicherter Spielstand: Engine-Zustand (reines JSON) und der Seed, mit dem die Partie begann. */
export interface SavedGame {
  version: 1;
  seed: string;
  savedAt: number;
  state: GameState;
}

/**
 * Ablage für Spielstände. Heute `localStorage`, später z. B. Cloud-Sync – die App kennt nur dieses Interface.
 * Alle Methoden dürfen nicht werfen: Speichern ist Komfort, kein Spielinhalt.
 */
export interface SaveStore {
  load(): SavedGame | null;
  save(game: SavedGame): void;
  clear(): void;
}

const KEY = 'being-god.save.v1';

export class LocalSaveStore implements SaveStore {
  constructor(private readonly key: string = KEY) {}

  load(): SavedGame | null {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SavedGame> | null;
      if (!parsed || parsed.version !== 1 || typeof parsed.seed !== 'string' || !parsed.state) return null;
      if (parsed.state.version !== STATE_VERSION) return null;
      return parsed as SavedGame;
    } catch {
      return null;
    }
  }

  save(game: SavedGame): void {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(game));
    } catch {
      // Privater Modus, Speicher voll o. Ä.: Spiel läuft ohne Speichern weiter.
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(this.key);
    } catch {
      // siehe save()
    }
  }
}

/** Flüchtige Ablage (Tests, `?nosave`). */
export class MemorySaveStore implements SaveStore {
  private game: SavedGame | null = null;
  load(): SavedGame | null {
    return this.game ? structuredClone(this.game) : null;
  }
  save(game: SavedGame): void {
    this.game = structuredClone(game);
  }
  clear(): void {
    this.game = null;
  }
}
