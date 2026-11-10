import type { Action, GameView } from '@core/api';

/**
 * Adapter zwischen App und Engine. Die App kennt nur dieses Interface:
 * Zustand lesen (`getView`), Aktionen schicken (`dispatch`), auf Änderungen hören (`subscribe`).
 */
export interface GameClient {
  getView(): GameView;
  dispatch(action: Action): void;
  /** Meldet jede neue GameView; gibt eine Abmelde-Funktion zurück. */
  subscribe(listener: () => void): () => void;
  /** Neue Partie starten (Spiel-Ende-Bildschirm). */
  newGame(): void;
  /** true, solange Vorschau-Daten statt der echten Engine laufen. */
  readonly isMock: boolean;
}
