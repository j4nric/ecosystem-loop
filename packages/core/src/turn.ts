/** Zug-Regeln: legale Kartenzüge und Kartenzwang (Konzept 3, 6.2). */
import type { Play } from './api.ts';
import { bindingsFor, canPlayMore, getCard } from './cards/play.ts';
import type { GameData } from './schema/index.ts';
import type { GameState } from './state.ts';

/** Alle in diesem Moment legalen (bezahlbaren) Kartenzüge. */
export function legalPlays(data: GameData, state: GameState): Play[] {
  if (!canPlayMore(data, state)) return [];
  return state.hand.flatMap((inst) => {
    const card = getCard(data, inst.card);
    if (card.cost > state.breath) return [];
    return bindingsFor(data, state, card).map((targets) => ({ uid: inst.uid, card: inst.card, targets }));
  });
}

/** Kartenzwang: Zugende erst nach minPlays Karten – außer es ist keine bezahlbare Karte spielbar. */
export function canEndTurn(data: GameData, state: GameState): boolean {
  if (state.phase !== 'play') return false;
  if (state.playsThisTurn >= data.config.turn.minPlays) return true;
  return legalPlays(data, state).length === 0;
}
