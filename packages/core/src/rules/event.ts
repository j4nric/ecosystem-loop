/** Ereignis (Konzept 9, Natur-Schritt 2): Das angekündigte Ereignis dieser Runde tritt ein. */
import { z } from 'zod';
import { applyEffect } from '../cards/effects.ts';
import { getCard, resolveCard } from '../cards/play.ts';
import { isWorldCard, resolveWorldCard } from '../cards/worldcard.ts';
import { holdsAll } from '../conditions.ts';
import type { Effect, EventDef, GameData } from '../schema/index.ts';
import type { ForecastState, GameEvent, GameState } from '../state.ts';
import { RuleError } from '../world.ts';
import { targetZones } from './forecast.ts';
import { defineRule } from './module.ts';

export const EventParams = z.strictObject({});

export function getEvent(data: GameData, id: string): EventDef {
  const e = data.events.get(id);
  if (!e) throw new RuleError(`Unbekanntes Ereignis: ${id}`);
  return e;
}

/** Skaliert die Stärke eines Effekts (nur Änderungen um `by`; Vorzeichen bleibt, mindestens 1). */
export function scaleEffect(e: Effect, strength: number): Effect {
  if (strength === 1 || !('by' in e) || e.by === 0) return e;
  return { ...e, by: Math.sign(e.by) * Math.max(1, Math.round(Math.abs(e.by) * strength)) };
}

/** Dichteste Population unter den Zielzonen: höchster Bestand, bei Gleichstand Zonen- und Arten-Reihenfolge. */
export function densest(
  data: GameData,
  state: GameState,
  def: EventDef,
): { zone: string; species: string; count: number } | null {
  let best: { zone: string; species: string; count: number } | null = null;
  for (const zone of targetZones(data, state, def))
    for (const sp of data.species.values()) {
      const count = zone.populations[sp.id] ?? 0;
      if (count > 0 && (!best || count > best.count)) best = { zone: zone.id, species: sp.id, count };
    }
  return best;
}

/** Lässt ein Ereignis eintreten (auch für Tests und Vorschauen nutzbar). */
export function occur(data: GameData, state: GameState, f: ForecastState, emit: (e: GameEvent) => void): void {
  const def = getEvent(data, f.event);
  const bind: Record<string, string> = {};
  if (def.target?.pick === 'random' && f.zone !== null) bind.target = f.zone;
  if (def.target?.pick === 'densest') {
    // AUSLEGUNG: Die Seuche trifft die Population, die beim Eintreten am dichtesten ist (angekündigt ohne Zone).
    const d = densest(data, state, def);
    if (d) Object.assign(bind, { target: d.zone, species: d.species });
  }
  const zone = bind.target ?? null;
  emit({ type: 'eventOccurred', event: def.id, zone, strength: f.strength });
  state.eventsOccurred++;
  // Ein Ereignis mit Zielzone, das keine (mehr) findet, verpufft.
  if (def.target && zone === null) return;
  const cause = `event:${def.id}`;
  const scaled = (e: Effect) => scaleEffect(e, f.strength);
  for (const rule of def.rules) {
    const zones = state.zones.filter(
      (z) =>
        (rule.geographies.length === 0 || rule.geographies.includes(z.geography)) &&
        holdsAll(rule.when, { data, state, zone: z }),
    );
    for (const z of zones)
      for (const e of rule.effects) applyEffect({ data, state, emit, bind: { ...bind, self: z.id }, cause }, scaled(e));
  }
  for (const e of def.effects) applyEffect({ data, state, emit, bind, cause }, scaled(e));
  if (def.card) {
    const card = getCard(data, def.card);
    // AUSLEGUNG: Eine Weltkarte als Ereignis wirkt nur auf die Zielzone, wenn das Ereignis eine hat
    // (Blitzschlag trifft eine Zone), sonst auf alle Zonen – je Geografie wie beim Ausspielen.
    if (isWorldCard(card)) resolveWorldCard(data, state, card, {}, emit, cause, zone === null ? undefined : [zone]);
    else if (zone !== null) resolveCard(data, state, card, { [card.slots[0]!.id]: zone }, emit, cause);
  }
}

export const event = defineRule({
  id: 'event',
  params: EventParams,
  run({ data, state, emit }) {
    const f = state.forecast;
    if (!f || f.round !== state.round) return;
    state.forecast = null;
    occur(data, state, f, emit);
  },
});
