import type { HerdeState } from '@being-god/herde';

/** Ein Eintrag im Geschehen-Protokoll (bereits lokalisierter Text). */
export interface LogEntry {
  /** Monat seit Spielbeginn, in dem es geschah */
  month: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

/**
 * Ein gespeicherter Spielstand: Engine-Zustand (reines JSON, noch ungeprüft), Seed der Partie und Protokoll.
 * Ob der Zustand zu den Spieldaten passt, prüft der Client mit `validateState` der Engine.
 */
export interface SavedGame {
  version: 2;
  seed: string;
  savedAt: number;
  state: HerdeState;
  log: LogEntry[];
}

/** Ergebnis des Ladens: ein Stand, nichts, oder ein alter bzw. kaputter Stand, der verworfen wurde. */
export type LoadResult =
  | { kind: 'game'; game: SavedGame }
  | { kind: 'none' }
  /** Spielstand aus der alten Engine (Konzept 0.4) */
  | { kind: 'legacy' }
  /** Spielstand im neuen Schlüssel, aber nicht lesbar */
  | { kind: 'broken' };

/**
 * Ablage für Spielstände. Heute `localStorage`, später z. B. `@capacitor/preferences` – die App kennt nur dieses
 * Interface. Methoden werfen nie: Speichern ist Komfort, kein Spielinhalt.
 */
export interface SaveStore {
  load(): LoadResult;
  save(game: SavedGame): void;
  clear(): void;
}

export const SAVE_KEY = 'being-god.herde.save.v1';
/** Schlüssel der alten App (Konzept 0.4): Spielstand, Schöpfungsbuch, Startdeck, Einführung. */
export const LEGACY_KEYS = ['being-god.save.v1', 'being-god.book.v1', 'being-god.deck.v1', 'being-god.tutorial.v1'];
const LEGACY_SAVE = LEGACY_KEYS[0]!;

/** Liest einen gespeicherten Text in die Form von SavedGame (nur die Hülle; den Zustand prüft die Engine). */
export function parseSaved(raw: string): SavedGame | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SavedGame> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 2) return null;
    if (typeof parsed.seed !== 'string' || !parsed.state || typeof parsed.state !== 'object') return null;
    const log = Array.isArray(parsed.log) ? parsed.log.filter(isLogEntry) : [];
    return { version: 2, seed: parsed.seed, savedAt: Number(parsed.savedAt) || 0, state: parsed.state, log };
  } catch {
    return null;
  }
}

function isLogEntry(x: unknown): x is LogEntry {
  const e = x as Partial<LogEntry> | null;
  return !!e && typeof e.text === 'string' && typeof e.month === 'number' && typeof e.tone === 'string';
}

export class LocalSaveStore implements SaveStore {
  constructor(private readonly key: string = SAVE_KEY) {}

  load(): LoadResult {
    try {
      const storage = window.localStorage;
      // Alte Stände (Konzept 0.4) passen nicht zur neuen Engine: verwerfen und einmal freundlich darauf hinweisen.
      const legacy = storage.getItem(LEGACY_SAVE) !== null;
      for (const key of LEGACY_KEYS) storage.removeItem(key);
      const raw = storage.getItem(this.key);
      if (raw) {
        const game = parseSaved(raw);
        if (game) return { kind: 'game', game };
        storage.removeItem(this.key);
        return { kind: 'broken' };
      }
      return legacy ? { kind: 'legacy' } : { kind: 'none' };
    } catch {
      return { kind: 'none' };
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
  constructor(private readonly initial: LoadResult = { kind: 'none' }) {}
  load(): LoadResult {
    if (this.game) return { kind: 'game', game: structuredClone(this.game) };
    return this.initial;
  }
  save(game: SavedGame): void {
    this.game = structuredClone(game);
  }
  clear(): void {
    this.game = null;
  }
}
