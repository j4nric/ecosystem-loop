/** Natur-Phase und Bilanz: Regel-Module in der Reihenfolge aus config.yaml → pipeline (Konzept 3). */
import { RULES } from './rules/index.ts';
import { rngOf } from './rng.ts';
import type { GameData } from './schema/index.ts';
import type { GameEvent, GameState } from './state.ts';

export function runNature(data: GameData, state: GameState, emit: (e: GameEvent) => void): void {
  for (const id of data.config.pipeline) {
    const m = RULES.get(id);
    if (!m) throw new Error(`Unbekanntes Regel-Modul: ${id}`);
    m.run({ data, state, params: data.params[id], emit, rng: rngOf(state) });
    if (state.phase === 'over') return;
  }
}
