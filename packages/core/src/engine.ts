/**
 * Regel-Engine einer Expedition.
 *
 * Zugablauf:
 *   1. Der Spieler spielt nacheinander beliebig viele Karten (mind. hand.minPlaysPerTurn).
 *      Jede Karte wirkt sofort: Schwellen der Karte werden am Zustand VOR ihrem Grundeffekt
 *      geprüft – darum hat die Reihenfolge der gespielten Karten Einfluss.
 *   2. endTurn(): Zonenwechsel → Fressen → Auszüge → Einzüge → Nachziehen.
 *      Ist der Nachziehstapel leer, endet die Expedition.
 *   3. Zu Beginn eines Zuges (bevor eine Karte gespielt wurde) kann der Spieler die
 *      Expedition freiwillig beenden.
 */
import { getZone, hasAnimal, holdsAll } from './conditions.ts';
import { nextInt, seedFrom, shuffle } from './rng.ts';
import { STATS, type Card, type Condition, type Effect, type GameData, type Slot, type Stat } from './schema.ts';
import type { Choices, EndReason, ExpeditionState, GameEvent, ZoneState } from './state.ts';

export class RuleError extends Error {}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export interface ExpeditionSetup {
  deck: readonly string[];
  scenario?: string;
  seed?: string | number;
}

export function createExpedition(data: GameData, setup: ExpeditionSetup): ExpeditionState {
  const scenarioId = setup.scenario ?? 'standard';
  const scenario = data.scenarios.get(scenarioId);
  if (!scenario) throw new RuleError(`Unbekanntes Szenario: ${scenarioId}`);
  for (const c of setup.deck) if (!data.cards.has(c)) throw new RuleError(`Unbekannte Karte im Deck: ${c}`);

  const { min, max } = data.config.values;
  const zones: ZoneState[] = data.mapZones.map((mz) => {
    const override = scenario.zones[mz.id];
    const values = { ...mz.values };
    for (const s of STATS) {
      values[s] = clamp((override?.values?.[s] ?? values[s]) + (scenario.adjust[s] ?? 0), min, max);
    }
    return {
      id: mz.id,
      type: override?.type ?? mz.type,
      values,
      neighbors: [...mz.neighbors],
      tags: [...mz.tags],
      animals: [],
      lastDisturbanceTurn: 0,
      pending: {},
    };
  });

  const state: ExpeditionState = {
    rng: seedFrom(setup.seed ?? Date.now()),
    scenario: scenarioId,
    turn: 1,
    phase: 'play',
    endReason: null,
    zones,
    hand: [],
    drawPile: [],
    discardPile: [],
    nextUid: 1,
    playsThisTurn: 0,
    cardPlays: {},
    arrivedSpecies: [],
    log: [],
  };
  state.drawPile = shuffle(
    state,
    setup.deck.map((card) => ({ uid: state.nextUid++, card })),
  );
  emit(state, { type: 'turnStarted', turn: 1 });
  drawUpTo(state, data.config.hand.size);
  return state;
}

// ---------------------------------------------------------------------------
// Ziele wählen
// ---------------------------------------------------------------------------

export function getCard(data: GameData, id: string): Card {
  const c = data.cards.get(id);
  if (!c) throw new RuleError(`Unbekannte Karte: ${id}`);
  return c;
}

/** Gültige Werte für einen Slot, abhängig von bereits gewählten Slots. */
export function slotOptions(
  data: GameData,
  state: ExpeditionState,
  slot: Slot,
  choices: Choices,
  playedUid: number,
): string[] {
  const zoneOk = (z: ZoneState, when: readonly Condition[]) => holdsAll(when, { data, state, zone: z });
  switch (slot.kind) {
    case 'zone':
      return state.zones.filter((z) => zoneOk(z, slot.when)).map((z) => z.id);
    case 'neighbor': {
      const of = choices[slot.of];
      if (!of) return [];
      return getZone(state, of)
        .neighbors.map((n) => getZone(state, n))
        .filter((z) => zoneOk(z, slot.when))
        .map((z) => z.id);
    }
    case 'otherZone': {
      const of = choices[slot.of];
      if (!of) return [];
      const base = getZone(state, of);
      return state.zones
        .filter((z) => z.id !== of && !base.neighbors.includes(z.id) && zoneOk(z, slot.when))
        .map((z) => z.id);
    }
    case 'animal': {
      const zid = choices[slot.in];
      if (!zid) return [];
      return [...new Set(getZone(state, zid).animals.map((a) => a.id))];
    }
    case 'handCard':
      return state.hand.filter((c) => c.uid !== playedUid).map((c) => String(c.uid));
  }
}

/** Alle vollständigen Zielbelegungen einer Handkarte (leer = nicht spielbar). */
export function bindingsFor(data: GameData, state: ExpeditionState, uid: number): Choices[] {
  const inst = state.hand.find((c) => c.uid === uid);
  if (!inst) return [];
  const card = getCard(data, inst.card);
  const out: Choices[] = [];
  const walk = (i: number, acc: Choices) => {
    if (i === card.slots.length) {
      out.push({ ...acc });
      return;
    }
    const slot = card.slots[i]!;
    for (const v of slotOptions(data, state, slot, acc, uid)) {
      acc[slot.id] = v;
      walk(i + 1, acc);
      delete acc[slot.id];
    }
  };
  walk(0, {});
  return out;
}

export interface Play {
  uid: number;
  card: string;
  choices: Choices;
}

/** Alle in diesem Moment legalen Kartenzüge. */
export function legalPlays(data: GameData, state: ExpeditionState): Play[] {
  if (!canPlayMore(data, state)) return [];
  return state.hand.flatMap((inst) =>
    bindingsFor(data, state, inst.uid).map((choices) => ({ uid: inst.uid, card: inst.card, choices })),
  );
}

export function canPlayMore(data: GameData, state: ExpeditionState): boolean {
  const max = data.config.hand.maxPlaysPerTurn;
  return state.phase === 'play' && (max === null || state.playsThisTurn < max);
}

export function canEndTurn(data: GameData, state: ExpeditionState): boolean {
  if (state.phase !== 'play') return false;
  if (state.playsThisTurn >= data.config.hand.minPlaysPerTurn) return true;
  // Kartenzwang greift nur, wenn überhaupt eine Karte spielbar ist.
  return legalPlays(data, state).length === 0;
}

export function canEndExpedition(state: ExpeditionState): boolean {
  return state.phase === 'play' && state.playsThisTurn === 0;
}

// ---------------------------------------------------------------------------
// Karte spielen
// ---------------------------------------------------------------------------

export function playCard(data: GameData, state: ExpeditionState, uid: number, choices: Choices): void {
  if (!canPlayMore(data, state)) throw new RuleError('In diesem Zug kann keine Karte mehr gespielt werden.');
  const idx = state.hand.findIndex((c) => c.uid === uid);
  if (idx < 0) throw new RuleError(`Karte ${uid} ist nicht auf der Hand.`);
  const inst = state.hand[idx]!;
  const card = getCard(data, inst.card);

  // Ziele validieren (in Slot-Reihenfolge, da spätere Slots von früheren abhängen).
  const bound: Choices = {};
  for (const slot of card.slots) {
    const v = choices[slot.id];
    if (v === undefined) throw new RuleError(`Ziel fehlt: ${slot.id}`);
    if (!slotOptions(data, state, slot, bound, uid).includes(v))
      throw new RuleError(`Ungültiges Ziel für ${slot.id}: ${v}`);
    bound[slot.id] = v;
  }

  state.hand.splice(idx, 1);
  state.playsThisTurn++;
  state.cardPlays[card.id] = (state.cardPlays[card.id] ?? 0) + 1;
  emit(state, { type: 'cardPlayed', card: card.id, choices: bound });
  resolveCard(data, state, card, bound, 0);
  state.discardPile.push(inst);
}

function resolveCard(data: GameData, state: ExpeditionState, card: Card, b: Choices, depth: number): void {
  if (depth > 4) throw new RuleError(`include-Kette zu tief bei ${card.id}`);
  const zoneOf = (slot: string) => getZone(state, b[slot] ?? slot);
  const fires = (check: 'before' | 'after') =>
    card.triggers.filter((t) => t.check === check && holdsAll(t.when, { data, state, zone: zoneOf(t.at) }));

  const before = fires('before');
  for (const e of card.effects) applyEffect(data, state, e, b, depth);
  const after = fires('after');
  for (const t of [...before, ...after]) {
    const zone = zoneOf(t.at);
    emit(state, { type: 'triggered', card: card.id, trigger: t.id, zone: zone.id, disturbance: t.disturbance });
    if (t.disturbance) zone.lastDisturbanceTurn = state.turn;
    for (const e of t.effects) applyEffect(data, state, e, b, depth);
  }
}

function targets(state: ExpeditionState, at: string, scope: 'self' | 'neighbors', b: Choices): ZoneState[] {
  const zone = getZone(state, b[at] ?? at);
  return scope === 'self' ? [zone] : zone.neighbors.map((n) => getZone(state, n));
}

function applyEffect(data: GameData, state: ExpeditionState, e: Effect, b: Choices, depth: number): void {
  const { min, max } = data.config.values;
  if ('adjust' in e || 'set' in e) {
    const stat: Stat = 'adjust' in e ? e.adjust : e.set;
    for (const z of targets(state, e.at, e.scope, b)) {
      const from = z.values[stat];
      const to = clamp('adjust' in e ? from + e.by : e.value, min, max);
      if (to !== from) {
        z.values[stat] = to;
        emit(state, { type: 'valueChanged', zone: z.id, stat, from, to });
      }
    }
  } else if ('addTag' in e) {
    for (const z of targets(state, e.at, e.scope, b))
      if (!z.tags.includes(e.addTag)) {
        z.tags.push(e.addTag);
        emit(state, { type: 'tagAdded', zone: z.id, tag: e.addTag });
      }
  } else if ('removeTag' in e) {
    for (const z of targets(state, e.at, e.scope, b))
      if (z.tags.includes(e.removeTag)) {
        z.tags = z.tags.filter((t) => t !== e.removeTag);
        emit(state, { type: 'tagRemoved', zone: z.id, tag: e.removeTag });
      }
  } else if ('draw' in e) {
    drawUpTo(state, state.hand.length + e.draw);
  } else if ('discard' in e) {
    const uid = Number(b[e.discard]);
    const i = state.hand.findIndex((c) => c.uid === uid);
    if (i >= 0) {
      const [inst] = state.hand.splice(i, 1);
      state.discardPile.push(inst!);
      emit(state, { type: 'cardDiscarded', card: inst!.card });
    }
  } else if ('moveAnimal' in e) {
    const animal = b[e.moveAnimal]!;
    const from = getZone(state, b[e.from]!);
    const to = getZone(state, b[e.to]!);
    const i = from.animals.findIndex((a) => a.id === animal);
    if (i >= 0 && !hasAnimal(to, animal)) {
      const [p] = from.animals.splice(i, 1);
      to.animals.push({ ...p!, withPredatorTurns: 0 });
      emit(state, { type: 'animalMoved', animal, from: from.id, to: to.id });
    }
  } else if ('connect' in e) {
    const a = getZone(state, b[e.connect[0]]!);
    const c = getZone(state, b[e.connect[1]]!);
    if (a.id !== c.id && !a.neighbors.includes(c.id)) {
      a.neighbors.push(c.id);
      c.neighbors.push(a.id);
      emit(state, { type: 'zonesConnected', a: a.id, b: c.id });
    }
  } else if ('include' in e) {
    resolveCard(data, state, getCard(data, e.include), b, depth + 1);
  } else {
    const never: never = e;
    throw new Error(`Unbekannter Effekt: ${JSON.stringify(never)}`);
  }
}

// ---------------------------------------------------------------------------
// Zugende
// ---------------------------------------------------------------------------

export function endTurn(data: GameData, state: ExpeditionState): void {
  if (!canEndTurn(data, state))
    throw new RuleError(`Kartenzwang: mindestens ${data.config.hand.minPlaysPerTurn} Karte(n) spielen.`);
  resolveEcosystem(data, state);

  const { maxTurns, onEmptyDrawPile } = data.config.end;
  if (maxTurns !== null && state.turn >= maxTurns) return finish(state, 'maxTurns');
  if (onEmptyDrawPile && state.drawPile.length === 0) return finish(state, 'deckEmpty');

  state.turn++;
  state.playsThisTurn = 0;
  emit(state, { type: 'turnStarted', turn: state.turn });
  drawUpTo(state, data.config.hand.size);
}

export function endExpedition(state: ExpeditionState): void {
  if (!canEndExpedition(state)) throw new RuleError('Die Expedition kann nur zu Beginn eines Zuges beendet werden.');
  finish(state, 'voluntary');
}

/** Ökosystem-Schritt am Zugende. Exportiert für Tests und Vorschau. */
export function resolveEcosystem(data: GameData, state: ExpeditionState): void {
  // 1. Zonenwechsel
  for (const z of state.zones) {
    const type = data.zoneTypes.get(z.type);
    const tr = type?.transitions.find((t) => holdsAll(t.when, { data, state, zone: z }));
    if (tr) {
      emit(state, { type: 'zoneTypeChanged', zone: z.id, from: z.type, to: tr.to });
      z.type = tr.to;
    }
  }

  // 2. Fressen: Beute verschwindet nach N Zugenden gemeinsam mit einem Fresser.
  for (const z of state.zones) {
    for (const prey of [...z.animals]) {
      const predators = z.animals.filter((p) => data.animals.get(p.id)?.eats.includes(prey.id)).map((p) => p.id);
      prey.withPredatorTurns = predators.length > 0 ? prey.withPredatorTurns + 1 : 0;
      if (prey.withPredatorTurns >= data.config.predation.extinctionTurns) {
        z.animals = z.animals.filter((a) => a !== prey);
        emit(state, { type: 'animalEaten', prey: prey.id, predators, zone: z.id });
      }
    }
  }

  // 3. Auszüge (erst alle prüfen, dann entfernen – reihenfolgeunabhängig)
  const leaving = state.zones.flatMap((z) =>
    z.animals
      .filter((a) => !holdsAll(data.animals.get(a.id)!.conditions, { data, state, zone: z }))
      .map((a) => ({ z, a })),
  );
  for (const { z, a } of leaving) {
    z.animals = z.animals.filter((x) => x !== a);
    emit(state, { type: 'animalLeft', animal: a.id, zone: z.id });
  }

  // 4. Einzüge (erst Kandidaten aller Zonen bestimmen, dann einziehen lassen)
  const { delayTurns, perZonePerTurn, cardOnArrival } = data.config.arrival;
  const arrivals: { z: ZoneState; animal: string }[] = [];
  for (const z of state.zones) {
    const ready: string[] = [];
    for (const animal of data.animals.values()) {
      if (hasAnimal(z, animal.id)) continue;
      if (holdsAll(animal.conditions, { data, state, zone: z })) {
        z.pending[animal.id] = (z.pending[animal.id] ?? 0) + 1;
        if (z.pending[animal.id]! > delayTurns) ready.push(animal.id);
      } else {
        delete z.pending[animal.id];
      }
    }
    for (let i = 0; i < perZonePerTurn && ready.length > 0; i++) {
      const animal = ready.splice(nextInt(state, ready.length), 1)[0]!;
      arrivals.push({ z, animal });
    }
  }
  for (const { z, animal } of arrivals) {
    delete z.pending[animal];
    z.animals.push({ id: animal, arrivedTurn: state.turn, withPredatorTurns: 0 });
    const first = !state.arrivedSpecies.includes(animal);
    if (first) state.arrivedSpecies.push(animal);
    let cardAdded: string | null = null;
    if (cardOnArrival === 'every' || first) {
      cardAdded = data.animals.get(animal)!.card;
      const pos = nextInt(state, state.drawPile.length + 1);
      state.drawPile.splice(pos, 0, { uid: state.nextUid++, card: cardAdded });
    }
    emit(state, { type: 'animalArrived', animal, zone: z.id, cardAdded });
  }
}

// ---------------------------------------------------------------------------
// Wertung und Hilfen
// ---------------------------------------------------------------------------

export interface ExpeditionReport {
  /** Arten, die jetzt im Wald sind (je Art einmal). */
  species: string[];
  /** Summe der Stufen der anwesenden Arten. */
  points: number;
  highestTier: number;
  individuals: number;
}

export function report(data: GameData, state: ExpeditionState): ExpeditionReport {
  const species = [...new Set(state.zones.flatMap((z) => z.animals.map((a) => a.id)))];
  const tiers = species.map((s) => data.animals.get(s)!.tier);
  return {
    species,
    points: tiers.reduce((a, b) => a + b, 0),
    highestTier: Math.max(0, ...tiers),
    individuals: state.zones.reduce((n, z) => n + z.animals.length, 0),
  };
}

export interface Warning {
  zone: string;
  card: string;
  trigger: string;
  icon: string | undefined;
}

/**
 * Sichtbare Warnungen: Schwellen von Handkarten, die bei Ausspielen auf eine Zone
 * auslösen würden (z. B. 🔥 bei Gewitter auf trockener Zone).
 */
export function warnings(data: GameData, state: ExpeditionState): Warning[] {
  const out: Warning[] = [];
  const seen = new Set<string>();
  for (const inst of state.hand) {
    if (seen.has(inst.card)) continue;
    seen.add(inst.card);
    const card = getCard(data, inst.card);
    const firstZoneSlot = card.slots.find((s) => s.kind === 'zone')?.id;
    for (const t of card.triggers) {
      if (t.at !== firstZoneSlot || t.check !== 'before') continue;
      for (const z of state.zones)
        if (holdsAll(t.when, { data, state, zone: z }))
          out.push({ zone: z.id, card: card.id, trigger: t.id, icon: t.icon });
    }
  }
  return out;
}

function drawUpTo(state: ExpeditionState, n: number): void {
  while (state.hand.length < n && state.drawPile.length > 0) {
    const inst = state.drawPile.shift()!;
    state.hand.push(inst);
    emit(state, { type: 'cardDrawn', card: inst.card });
  }
}

function finish(state: ExpeditionState, reason: EndReason): void {
  state.phase = 'ended';
  state.endReason = reason;
  emit(state, { type: 'expeditionEnded', reason });
}

function emit(state: ExpeditionState, e: GameEvent): void {
  state.log.push(e);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
