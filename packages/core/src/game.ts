/**
 * Fassade der Engine v2: newGame, step, view, legalPlays, preview.
 * `step` ist rein: Der Eingangszustand wird nie verändert, Zufall läuft über den Seed im Zustand.
 */
import type { Action, GameSetup, Locale, Preview, Targets } from './api.ts';
import { drawUpTo } from './cards/deck.ts';
import { getCard, playFromHand } from './cards/play.ts';
import { canEndTurn } from './turn.ts';
import { breathParams } from './rules/breath.ts';
import { formFor } from './rules/forms.ts';
import { RULES } from './rules/index.ts';
import { LevelsParams } from './rules/levels.ts';
import { paramsOf } from './rules/module.ts';
import { rngOf, seedFrom } from './rng.ts';
import type { GameData } from './schema/index.ts';
import type { GameEvent, GameState, ZoneState } from './state.ts';
import { clamp, RuleError, seasonOf } from './world.ts';

export { view } from './view.ts';
export { canEndTurn, legalPlays } from './turn.ts';

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export function newGame(data: GameData, setup: GameSetup): GameState {
  const scenarioId = setup.scenario ?? 'standard';
  const scenario = data.scenarios.get(scenarioId);
  if (!scenario) throw new RuleError(`Unbekanntes Szenario: ${scenarioId}`);
  const deck = setup.deck ?? data.config.starterDeck;
  for (const c of deck) if (!data.cards.has(c)) throw new RuleError(`Unbekannte Karte im Deck: ${c}`);
  const { minSize, maxSize } = data.config.deck;
  if (deck.length < minSize || deck.length > maxSize)
    throw new RuleError(`Deck mit ${deck.length} Karten, erlaubt ${minSize}–${maxSize}.`);

  const { min, max } = data.config.scale;
  const lv = paramsOf(data, { id: 'levels', params: LevelsParams });
  const zones: ZoneState[] = data.zones.map((mz) => {
    const geo = data.geographies.get(mz.geography)!;
    const override = scenario.zones[mz.id];
    const stats: Record<string, number> = {};
    for (const s of [...data.commonStats, geo.special]) {
      const base = override?.stats[s] ?? mz.start[s] ?? geo.rest[s]!;
      stats[s] = clamp(base + (scenario.adjust[s] ?? 0), min, max);
    }
    return {
      id: mz.id,
      geography: mz.geography,
      stats,
      neighbors: [...mz.neighbors],
      tags: [...mz.tags],
      form: '',
      formSince: 0,
      level: clamp(override?.level ?? mz.level, lv.min, lv.max),
      levelProgress: 0,
      lastDisturbance: null,
      populations: {},
    };
  });

  const state: GameState = {
    version: 2,
    rng: seedFrom(setup.seed),
    scenario: scenarioId,
    round: 1,
    phase: 'play',
    harmony: scenario.harmony ?? data.harmony.start,
    harmonyTrend: 0,
    breath: scenario.breath ?? breathParams(data).start,
    zones,
    hand: [],
    drawPile: [],
    discardPile: [],
    nextUid: 1,
    playsThisTurn: 0,
    cardPlays: {},
  };
  for (const z of state.zones) z.form = formFor(data, state, z).id;
  state.drawPile = rngOf(state).shuffle(deck.map((card) => ({ uid: state.nextUid++, card })));
  drawUpTo(state, data.config.turn.handSize, () => {});
  return state;
}

export function step(data: GameData, state: GameState, action: Action): StepResult {
  if (state.phase !== 'play') throw new RuleError('Die Partie ist vorbei.');
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  const emit = (e: GameEvent) => events.push(e);

  if (action.type === 'play') {
    playFromHand(data, next, action.uid, action.targets, emit);
  } else {
    if (!canEndTurn(data, next))
      throw new RuleError(`Kartenzwang: mindestens ${data.config.turn.minPlays} Karte(n) spielen.`);
    emit({ type: 'turnEnded', round: next.round });
    runNature(data, next, emit);
    if (next.phase === 'play') {
      next.round++;
      next.playsThisTurn = 0;
      emit({ type: 'roundStarted', round: next.round, season: seasonOf(data, next.round).id });
      drawUpTo(next, data.config.turn.handSize, emit);
    }
  }
  return { state: next, events };
}

/** Natur-Phase und Bilanz: Module in der Reihenfolge aus config.yaml → pipeline. */
export function runNature(data: GameData, state: GameState, emit: (e: GameEvent) => void): void {
  for (const id of data.config.pipeline) {
    const m = RULES.get(id);
    if (!m) throw new Error(`Unbekanntes Regel-Modul: ${id}`);
    m.run({ data, state, params: data.params[id], emit, rng: rngOf(state) });
    if (state.phase === 'over') return;
  }
}

/** Vorschau eines Kartenzugs ohne Ausführung (Kosten werden angezeigt, aber nicht verlangt). */
export function preview(
  data: GameData,
  state: GameState,
  play: { uid: number; targets: Targets },
  locale: Locale = 'de',
): Preview {
  const inst = state.hand.find((c) => c.uid === play.uid);
  if (!inst) throw new RuleError(`Karte ${play.uid} ist nicht auf der Hand.`);
  const card = getCard(data, inst.card);
  const sim = structuredClone(state);
  const events: GameEvent[] = [];
  playFromHand(data, sim, play.uid, play.targets, (e) => events.push(e), true);

  const changes = new Map<string, Preview['changes'][number]>();
  const triggers: Preview['triggers'] = [];
  for (const e of events) {
    if (e.type === 'statChanged') {
      const key = `${e.zone}.${e.stat}`;
      const prev = changes.get(key);
      changes.set(key, { zone: e.zone, stat: e.stat, from: prev?.from ?? e.from, to: e.to });
    } else if (e.type === 'triggered') {
      const t = card.triggers.find((x) => x.id === e.trigger)!;
      triggers.push({ zone: e.zone, trigger: t.id, name: t.name[locale], icon: t.icon });
    }
  }
  const formChanges: Preview['formChanges'] = [];
  sim.zones.forEach((z, i) => {
    const to = formFor(data, sim, z).id;
    const from = state.zones[i]!.form;
    if (to !== from) formChanges.push({ zone: z.id, from, to });
  });
  return {
    cost: card.cost,
    affordable: card.cost <= state.breath,
    changes: [...changes.values()].filter((c) => c.from !== c.to),
    triggers,
    formChanges,
  };
}
