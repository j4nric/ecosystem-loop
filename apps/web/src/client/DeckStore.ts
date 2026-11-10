import { parseStoredDeck } from '../logic/deck.ts';

/** Ablage des zuletzt gewählten Startdecks (Karten-Ids). Methoden werfen nie. */
export interface DeckStore {
  load(): string[] | null;
  save(deck: readonly string[]): void;
}

const DECK_KEY = 'being-god.deck.v1';

export class LocalDeckStore implements DeckStore {
  constructor(private readonly key: string = DECK_KEY) {}

  load(): string[] | null {
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? parseStoredDeck(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  save(deck: readonly string[]): void {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(deck));
    } catch {
      // Speichern ist Komfort
    }
  }
}

/** Flüchtige Ablage (Tests, `?nosave`). */
export class MemoryDeckStore implements DeckStore {
  private deck: string[] | null = null;
  load(): string[] | null {
    return this.deck ? [...this.deck] : null;
  }
  save(deck: readonly string[]): void {
    this.deck = [...deck];
  }
}
