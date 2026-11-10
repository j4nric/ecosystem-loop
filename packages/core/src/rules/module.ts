/**
 * Schnittstelle der Regel-Module (docs/architektur.md). Jedes Modul hat eine Id (Schlüssel in
 * config.yaml → pipeline und rules.<id>), ein Parameter-Schema und eine run-Funktion.
 * Module verändern nur den GameState und melden jede Änderung als GameEvent.
 */
import type { z } from 'zod';
import type { Rng } from '../rng.ts';
import type { GameData } from '../schema/index.ts';
import type { GameEvent, GameState } from '../state.ts';

export interface RuleContext<P = unknown> {
  data: GameData;
  state: GameState;
  params: P;
  emit: (e: GameEvent) => void;
  rng: Rng;
}

export interface RuleModule<P = unknown> {
  id: string;
  /** Schema der Parameter unter rules.<id> in config.yaml (mit Defaults). */
  params: z.ZodType<P>;
  run(ctx: RuleContext<P>): void;
}

/** Typisiert ein Modul und löscht den Parametertyp für die Registry. */
export function defineRule<P>(m: RuleModule<P>): RuleModule {
  return m as unknown as RuleModule;
}

/** Parameter eines Moduls aus den geprüften Daten. */
export function paramsOf<P>(data: GameData, module: { id: string; params: z.ZodType<P> }): P {
  const p = data.params[module.id];
  if (p === undefined) throw new Error(`Parameter fehlen: rules.${module.id}`);
  return p as P;
}
