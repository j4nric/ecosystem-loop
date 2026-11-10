/** Kartenstapel: Nachziehen und Mischen der Ablage. */
import { rngOf } from '../rng.ts';
import type { GameEvent, GameState } from '../state.ts';

/** Zieht, bis die Hand n Karten hat. Ist der Stapel leer, wird die Ablage gemischt (Konzept 6.2). */
export function drawUpTo(state: GameState, n: number, emit: (e: GameEvent) => void): void {
  while (state.hand.length < n) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) return;
      state.drawPile = rngOf(state).shuffle(state.discardPile);
      state.discardPile = [];
      emit({ type: 'deckReshuffled', cards: state.drawPile.length });
    }
    const inst = state.drawPile.shift()!;
    state.hand.push(inst);
    emit({ type: 'cardDrawn', uid: inst.uid, card: inst.card });
  }
}
