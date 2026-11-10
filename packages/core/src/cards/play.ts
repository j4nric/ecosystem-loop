/** Karten ausspielen: Ziele, Kosten, Grundeffekte und Schwellen. */
import type { Targets } from '../api.ts';
import { holdsAll } from '../conditions.ts';
import type { Card, GameData, Slot, Trigger } from '../schema/index.ts';
import type { GameEvent, GameState } from '../state.ts';
import { populationOf } from '../population.ts';
import { getZone, markDisturbance, RuleError } from '../world.ts';
import { applyEffect, type EffectContext } from './effects.ts';

export function getCard(data: GameData, id: string): Card {
  const c = data.cards.get(id);
  if (!c) throw new RuleError(`Unbekannte Karte: ${id}`);
  return c;
}

/** Gültige Zonen (bzw. Arten) für einen Slot, abhängig von bereits gewählten Slots. */
export function slotOptions(data: GameData, state: GameState, slot: Slot, bound: Targets): string[] {
  if (slot.kind === 'choice') return slot.options.map((o) => o.id);
  if (slot.kind === 'species') {
    const zid = bound[slot.in];
    if (zid === undefined) return [];
    const zone = getZone(state, zid);
    return [...data.species.values()]
      .filter(
        (sp) =>
          populationOf(zone, sp.id) > 0 &&
          (slot.eats === undefined || sp.diet.includes(slot.eats)) &&
          (slot.species === undefined || slot.species.includes(sp.id)),
      )
      .map((sp) => sp.id);
  }
  const candidates =
    slot.kind === 'zone'
      ? state.zones
      : bound[slot.of] === undefined
        ? []
        : getZone(state, bound[slot.of]!).neighbors.map((n) => getZone(state, n));
  return candidates.filter((zone) => holdsAll(slot.when, { data, state, zone })).map((z) => z.id);
}

/** Alle vollständigen Zielbelegungen einer Karte (leer = keine gültigen Ziele). */
export function bindingsFor(data: GameData, state: GameState, card: Card): Targets[] {
  const out: Targets[] = [];
  const walk = (i: number, acc: Targets) => {
    if (i === card.slots.length) {
      out.push({ ...acc });
      return;
    }
    const slot = card.slots[i]!;
    for (const v of slotOptions(data, state, slot, acc)) {
      acc[slot.id] = v;
      walk(i + 1, acc);
      delete acc[slot.id];
    }
  };
  walk(0, {});
  return out;
}

/** Prüft die Ziele in Slot-Reihenfolge und gibt nur die bekannten Slots zurück. */
export function validateTargets(data: GameData, state: GameState, card: Card, targets: Targets): Targets {
  const bound: Targets = {};
  for (const slot of card.slots) {
    const v = targets[slot.id];
    if (v === undefined) throw new RuleError(`Ziel fehlt: ${slot.id}`);
    if (!slotOptions(data, state, slot, bound).includes(v)) throw new RuleError(`Ungültiges Ziel für ${slot.id}: ${v}`);
    bound[slot.id] = v;
  }
  return bound;
}

/** Schwellen der Karte, die mit diesen Zielen zum Zeitpunkt `check` auslösen. */
export function firingTriggers(
  data: GameData,
  state: GameState,
  card: Card,
  bound: Targets,
  check: Trigger['check'],
): Trigger[] {
  return card.triggers.filter((t) => {
    if (t.check !== check) return false;
    const zid = bound[t.at];
    return zid !== undefined && holdsAll(t.when, { data, state, zone: getZone(state, zid) });
  });
}

/** Wendet Grundeffekte und Schwellen einer Karte an (ohne Kosten, Hand und Ablage). */
export function resolveCard(
  data: GameData,
  state: GameState,
  card: Card,
  bound: Targets,
  emit: (e: GameEvent) => void,
  cause = `card:${card.id}`,
): void {
  const ctx: EffectContext = { data, state, emit, bind: bound, cause };
  const before = firingTriggers(data, state, card, bound, 'before');
  for (const e of card.effects) applyEffect(ctx, e);
  for (const slot of card.slots)
    if (slot.kind === 'choice')
      for (const e of slot.options.find((o) => o.id === bound[slot.id])?.effects ?? []) applyEffect(ctx, e);
  const after = firingTriggers(data, state, card, bound, 'after');
  for (const t of [...before, ...after]) {
    const zone = getZone(state, bound[t.at]!);
    emit({ type: 'triggered', card: card.id, trigger: t.id, zone: zone.id, disturbance: t.disturbance });
    if (t.disturbance) markDisturbance(state, zone, `trigger:${card.id}.${t.id}`, emit);
    for (const e of t.effects) applyEffect({ ...ctx, cause: `trigger:${card.id}.${t.id}` }, e);
  }
}

export function canPlayMore(data: GameData, state: GameState): boolean {
  const max = data.config.turn.maxPlays;
  return state.phase === 'play' && (max === null || state.playsThisTurn < max);
}

/**
 * Spielt eine Handkarte: prüft Phase, Zuglimit, Kosten und Ziele, zahlt Odem,
 * wendet die Karte an und legt sie auf die Ablage. `ignoreCost` dient der Vorschau.
 */
export function playFromHand(
  data: GameData,
  state: GameState,
  uid: number,
  targets: Targets,
  emit: (e: GameEvent) => void,
  ignoreCost = false,
): void {
  if (!canPlayMore(data, state)) throw new RuleError('In dieser Runde kann keine Karte mehr gespielt werden.');
  const idx = state.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) throw new RuleError(`Karte ${uid} ist nicht auf der Hand.`);
  const inst = state.hand[idx]!;
  const card = getCard(data, inst.card);
  if (!ignoreCost && card.cost > state.breath)
    throw new RuleError(`Zu wenig Odem: ${card.id} kostet ${card.cost}, vorhanden ${state.breath}.`);
  const bound = validateTargets(data, state, card, targets);

  state.hand.splice(idx, 1);
  state.playsThisTurn++;
  state.cardPlays[card.id] = (state.cardPlays[card.id] ?? 0) + 1;
  const cost = ignoreCost ? 0 : card.cost;
  emit({ type: 'cardPlayed', uid, card: card.id, targets: bound, cost });
  if (cost > 0) {
    const from = state.breath;
    state.breath -= cost;
    emit({ type: 'breathChanged', from, to: state.breath, cause: `card:${card.id}` });
  }
  resolveCard(data, state, card, bound, emit);
  state.discardPile.push(inst);
}
