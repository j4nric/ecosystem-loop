/**
 * Bots für automatisierte Balancing-Läufe.
 *
 * - random: spielt zufällige legale Karten, beendet selten freiwillig.
 * - greedy: schaut jeweils einen Kartenzug plus Zugende voraus und wählt, was die Wertung
 *   am stärksten verbessert; steigt aus, wenn jeder mögliche Zug die Wertung senken würde.
 *   Hinweis: Die Vorausschau nutzt eine Kopie des Spielzustands inkl. Zufallsgenerator und
 *   „kennt“ damit den Ausgang des nächsten Zugendes – das macht ihn etwas stärker als einen Menschen.
 */
import {
  canEndExpedition,
  canEndTurn,
  endExpedition,
  endTurn,
  legalPlays,
  playCard,
  report,
  type Play,
} from '../core/engine.ts';
import { cardPool, type Notebook } from '../core/meta.ts';
import { nextFloat, nextInt, seedFrom, type RngHolder } from '../core/rng.ts';
import type { GameData } from '../core/schema.ts';
import type { ExpeditionState } from '../core/state.ts';

export interface Bot {
  name: string;
  buildDeck(data: GameData, nb: Notebook): string[];
  /** Spielt einen kompletten Zug (Karten + Zugende) oder beendet die Expedition. */
  takeTurn(data: GameData, state: ExpeditionState): void;
}

export type BotName = 'random' | 'greedy';

export function createBot(name: BotName, seed: string | number = 1): Bot {
  return name === 'random' ? randomBot(seed) : greedyBot();
}

/** Startdeck + freigeschaltete Tierkarten (je 1×, höchste Stufe zuerst) bis zur Maximalgröße. */
export function defaultDeck(data: GameData, nb: Notebook): string[] {
  const deck = [...data.config.starterDeck];
  const tierOf = (card: string) =>
    Math.max(0, ...[...data.animals.values()].filter((a) => a.card === card).map((a) => a.tier));
  const extras = cardPool(data, nb)
    .filter((c) => data.cards.get(c)?.source === 'animal')
    .sort((a, b) => tierOf(b) - tierOf(a));
  for (const c of extras) {
    if (deck.length >= data.config.deck.maxSize) break;
    deck.push(c);
  }
  return deck;
}

function randomBot(seed: string | number): Bot {
  const rng: RngHolder = { rng: seedFrom(`bot:${seed}`) };
  return {
    name: 'random',
    buildDeck: defaultDeck,
    takeTurn(data, state) {
      if (canEndExpedition(state) && report(data, state).points > 0 && nextFloat(rng) < 0.1) {
        endExpedition(state);
        return;
      }
      const wanted = 1 + nextInt(rng, data.config.hand.size);
      for (let i = 0; i < wanted; i++) {
        const plays = legalPlays(data, state);
        if (plays.length === 0) break;
        const p = plays[nextInt(rng, plays.length)]!;
        playCard(data, state, p.uid, p.choices);
      }
      if (canEndTurn(data, state)) endTurn(data, state);
    },
  };
}

function cloneForSim(state: ExpeditionState): ExpeditionState {
  return structuredClone({ ...state, log: [] });
}

/** Bewertung eines Zustands: Wertung plus kleine Boni für Tiere und Kartenvorrat. */
function value(data: GameData, s: ExpeditionState): number {
  const r = report(data, s);
  return r.points + 0.3 * r.individuals + 0.05 * (s.drawPile.length + s.hand.length);
}

function afterTurnEnd(data: GameData, s: ExpeditionState): ExpeditionState {
  const sim = cloneForSim(s);
  if (canEndTurn(data, sim)) endTurn(data, sim);
  return sim;
}

function greedyBot(): Bot {
  return {
    name: 'greedy',
    buildDeck: defaultDeck,
    takeTurn(data, state) {
      // Ausstiegsmoment: würde jeder mögliche Zug die Wertung senken?
      if (canEndExpedition(state)) {
        const now = report(data, state).points;
        if (now > 0) {
          const plays = legalPlays(data, state);
          const bestPoints = Math.max(
            -Infinity,
            ...plays.map((p) => {
              const sim = cloneForSim(state);
              playCard(data, sim, p.uid, p.choices);
              return report(data, afterTurnEnd(data, sim)).points;
            }),
          );
          if (plays.length > 0 && bestPoints < now) {
            endExpedition(state);
            return;
          }
        }
      }

      for (;;) {
        const plays = legalPlays(data, state);
        if (plays.length === 0) break;
        let best: Play | null = null;
        let bestScore = -Infinity;
        for (const p of plays) {
          const sim = cloneForSim(state);
          playCard(data, sim, p.uid, p.choices);
          const score = value(data, afterTurnEnd(data, sim));
          if (score > bestScore) {
            bestScore = score;
            best = p;
          }
        }
        const stopScore =
          state.playsThisTurn >= data.config.hand.minPlaysPerTurn
            ? value(data, afterTurnEnd(data, state))
            : -Infinity;
        if (!best || stopScore >= bestScore) break;
        playCard(data, state, best.uid, best.choices);
      }
      if (canEndTurn(data, state)) endTurn(data, state);
    },
  };
}
