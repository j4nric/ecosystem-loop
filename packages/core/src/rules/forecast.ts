/**
 * Vorschau (Konzept 3, 9): Am Ende der Bilanz wird über den RNG das Ereignis der nächsten Runde ausgelost
 * und angekündigt. Die Wahrscheinlichkeit, dass überhaupt eins kommt, und seine Stärke steigen mit den Jahren.
 */
import { z } from 'zod';
import { holdsAll } from '../conditions.ts';
import type { Rng } from '../rng.ts';
import type { EventDef, GameData } from '../schema/index.ts';
import type { GameEvent, GameState, ZoneState } from '../state.ts';
import { yearOf } from '../world.ts';
import { defineRule, paramsOf } from './module.ts';

/** Wert, der ab Jahr 1 bei `base` beginnt, je Jahr um `perYear` steigt und bei `max` endet. */
const Growth = z.strictObject({ base: z.number().nonnegative(), perYear: z.number().nonnegative(), max: z.number() });

export const ForecastParams = z.strictObject({
  /** Wahrscheinlichkeit (0–1), dass für eine Runde überhaupt ein Ereignis angekündigt wird. */
  chance: Growth,
  /** Stärke-Faktor der Ereignisse (multipliziert adjust/population-Effekte, gerundet). */
  strength: Growth,
});
export type ForecastParams = z.infer<typeof ForecastParams>;

const spec = { id: 'forecast', params: ForecastParams };

export function forecastParams(data: GameData): ForecastParams {
  return paramsOf(data, spec);
}

function grow(g: z.infer<typeof Growth>, year: number): number {
  return Math.min(g.max, g.base + g.perYear * (year - 1));
}

/** Wahrscheinlichkeit eines Ereignisses in diesem Jahr. */
export function eventChance(data: GameData, year: number): number {
  return Math.min(1, grow(forecastParams(data).chance, year));
}

/** Stärke-Faktor der Ereignisse in diesem Jahr. */
export function eventStrength(data: GameData, year: number): number {
  return grow(forecastParams(data).strength, year);
}

/** Zonen, die als Ziel eines Ereignisses infrage kommen (densest: nur Zonen mit Leben). */
export function targetZones(data: GameData, state: GameState, def: EventDef): ZoneState[] {
  const t = def.target;
  if (!t) return [];
  return state.zones.filter(
    (zone) =>
      holdsAll(t.when, { data, state, zone }) &&
      (t.pick === 'random' || Object.values(zone.populations).some((n) => n > 0)),
  );
}

/** Ereignisse, die in diesem Jahr und Zustand eintreten können. */
export function eligibleEvents(data: GameData, state: GameState, year: number): EventDef[] {
  return [...data.events.values()].filter(
    (e) => e.fromYear <= year && (!e.target || targetZones(data, state, e).length > 0),
  );
}

/**
 * Lost das Ereignis für die Natur-Phase von `round` aus und kündigt es an.
 * Verbraucht immer genau einen Zufallswert für „kommt eins?“, dann je einen für Auswahl und Zielzone.
 */
export function drawForecast(
  data: GameData,
  state: GameState,
  round: number,
  rng: Rng,
  emit: (e: GameEvent) => void,
): void {
  const year = yearOf(data, round);
  if (rng.float() >= eventChance(data, year)) return;
  const pool = eligibleEvents(data, state, year);
  if (pool.length === 0) return;
  let r = rng.float() * pool.reduce((s, e) => s + e.weight, 0);
  const def = pool.find((e) => (r -= e.weight) < 0) ?? pool[pool.length - 1]!;
  const zone = def.target?.pick === 'random' ? rng.pick(targetZones(data, state, def)).id : null;
  if (state.eventShield > 0) {
    state.eventShield--;
    emit({ type: 'eventCancelled', event: def.id, cause: 'shield' });
    return;
  }
  const strength = def.scales ? eventStrength(data, year) : 1;
  state.forecast = { event: def.id, round, strength, zone };
  emit({ type: 'eventForecast', event: def.id, round, zone, strength });
}

export const forecast = defineRule({
  ...spec,
  run({ data, state, emit, rng }) {
    // Ein verschobenes Ereignis steht schon für eine spätere Runde an: dann kein neues.
    if (state.forecast && state.forecast.round > state.round) return;
    state.forecast = null;
    drawForecast(data, state, state.round + 1, rng, emit);
  },
});
