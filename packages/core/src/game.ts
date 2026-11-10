/**
 * Fassade der Engine v2: newGame, step, view, legalPlays, slotOptions, preview, describeEvent, validateState.
 * `step` ist rein: Der Eingangszustand wird nie verändert, Zufall läuft über den Seed im Zustand.
 */
import type { Action, GameSetup, Locale, Preview, Targets } from './api.ts';
import { drawUpTo } from './cards/deck.ts';
import { bindingsFor, getCard, playFromHand } from './cards/play.ts';
import { deckIssueText, validateDeck } from './meta.ts';
import { drawForecast } from './rules/forecast.ts';
import { canEndTurn } from './turn.ts';
import { idealDistance, statDistance } from './targets.ts';
import { runNature } from './nature.ts';
import { addGifts, setPopulation } from './population.ts';
import { breathParams } from './rules/breath.ts';
import { evolutionParams } from './rules/evolution.ts';
import { formFor } from './rules/forms.ts';
import { LevelsParams } from './rules/levels.ts';
import { paramsOf } from './rules/module.ts';
import { rngOf, seedFrom } from './rng.ts';
import type { GameData } from './schema/index.ts';
import { STATE_VERSION, type GameEvent, type GameState, type ZoneState } from './state.ts';
import { clamp, geographyOf, getZone, RuleError, seasonOf, statsOf } from './world.ts';

export { view } from './view.ts';
export { describeEvent } from './describe.ts';
export { runNature } from './nature.ts';
export { canEndTurn, legalPlays } from './turn.ts';
export { validateState } from './validate.ts';

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export function newGame(data: GameData, setup: GameSetup): GameState {
  const scenarioId = setup.scenario ?? 'standard';
  const scenario = data.scenarios.get(scenarioId);
  if (!scenario) throw new RuleError(`Unbekanntes Szenario: ${scenarioId}`);
  const deck = setup.deck ?? data.config.starterDeck;
  // AUSLEGUNG: Ohne Schöpfungsbuch (Tests, Bots, Konsole) gilt nur Größe/Kopien/bekannte Karten, nicht der Pool.
  const issues = validateDeck(data, setup.book ?? null, deck);
  if (issues.length > 0) throw new RuleError(issues.map(deckIssueText).join(' '));

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
      lastHunger: null,
      evolution: {},
    };
  });

  const state: GameState = {
    version: STATE_VERSION,
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
    species: {},
    score: 0,
    extinctions: [],
    forecast: null,
    eventShield: 0,
    eventsOccurred: 0,
  };
  if (setup.vary ?? data.config.startWorld.vary) varyWorld(data, state, setup.seed);
  for (const z of state.zones) z.form = formFor(data, state, z).id;
  // Startleben: zählt ab Runde 0 als entstanden.
  state.round = 0;
  for (const [zid, pops] of Object.entries(scenario.populations))
    for (const [species, n] of Object.entries(pops))
      setPopulation(data, state, getZone(state, zid), species, n, () => {}, 'start');
  state.round = 1;
  const rng = rngOf(state);
  state.drawPile = rng.shuffle(deck.map((card) => ({ uid: state.nextUid++, card })));
  // AUSLEGUNG: Das Startleben ist „erstmals entstanden“ – seine Gaben kommen gleich zu Beginn ins Deck.
  if (evolutionParams(data).startGifts)
    for (const sp of data.species.values()) if (sp.id in state.species) addGifts(state, sp, rng.int, () => {});
  drawUpTo(state, data.config.turn.handSize, () => {});
  // Vorschau der ersten Runde (Konzept 3, Phase 1 „Vorschau“), nur wenn die Pipeline Ereignisse kennt.
  if (data.config.pipeline.includes('forecast')) drawForecast(data, state, state.round, rng, () => {});
  return state;
}

/**
 * Variierte Startwelt (Konzept 10, Wiederspielwert): Jeder Startwert streut um ±spread, deterministisch aus dem
 * Seed. Eigener Zufallsstrom, damit Deck und Ereignisse davon unabhängig bleiben.
 */
function varyWorld(data: GameData, state: GameState, seed: string | number): void {
  const spread = data.config.startWorld.spread;
  const rng = rngOf({ rng: seedFrom(`world:${seed}`) });
  for (const z of state.zones)
    for (const s of statsOf(data, geographyOf(data, z)))
      z.stats[s] = clamp(z.stats[s]! + rng.int(2 * spread + 1) - spread, data.config.scale.min, data.config.scale.max);
}

/**
 * Gültige Werte für den nächsten offenen Slot einer Handkarte (Zonen-, Art- oder Options-Ids), gegeben die
 * schon gewählten Ziele. Nur Werte, mit denen sich die Karte vollständig belegen lässt; Odem zählt hier nicht.
 * Leer, wenn die Karte nicht auf der Hand ist, alle Slots belegt sind oder die Wahl ungültig ist.
 */
export function slotOptions(data: GameData, state: GameState, uid: number, chosen: Targets): string[] {
  const inst = state.hand.find((c) => c.uid === uid);
  if (!inst) return [];
  const card = getCard(data, inst.card);
  const slot = card.slots.find((s) => chosen[s.id] === undefined);
  if (!slot) return [];
  const out = new Set<string>();
  for (const b of bindingsFor(data, state, card))
    if (Object.entries(chosen).every(([k, v]) => b[k] === v)) out.add(b[slot.id]!);
  return [...out];
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
  // Partie-Ende: einmal gemeldet, mit Endstand. Das Schöpfungsbuch trägt die Oberfläche ein (step bleibt rein).
  if (next.phase === 'over') emit({ type: 'gameOver', round: next.round, score: next.score });
  return { state: next, events };
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

  const zoneName = (id: string) => geographyOf(data, getZone(state, id)).name[locale];
  const formName = (id: string) => data.forms.get(id)?.form.name[locale] ?? id;
  const changes = new Map<string, Preview['changes'][number]>();
  const pops = new Map<string, NonNullable<Preview['populationChanges']>[number]>();
  const triggers: Preview['triggers'] = [];
  const eventChanges: NonNullable<Preview['eventChanges']> = [];
  const eventName = (id: string) => data.events.get(id)?.name[locale] ?? id;
  for (const e of events) {
    if (e.type === 'statChanged') {
      const key = `${e.zone}.${e.stat}`;
      const prev = changes.get(key);
      changes.set(key, {
        zone: e.zone,
        stat: e.stat,
        from: prev?.from ?? e.from,
        to: e.to,
        zoneName: zoneName(e.zone),
        statName: data.stats.get(e.stat)?.name[locale] ?? e.stat,
      });
    } else if (e.type === 'populationChanged') {
      const key = `${e.zone}.${e.species}`;
      const prev = pops.get(key);
      pops.set(key, {
        zone: e.zone,
        zoneName: zoneName(e.zone),
        species: e.species,
        speciesName: data.species.get(e.species)?.name[locale] ?? e.species,
        from: prev?.from ?? e.from,
        to: e.to,
      });
    } else if (e.type === 'triggered') {
      const t = card.triggers.find((x) => x.id === e.trigger)!;
      triggers.push({ zone: e.zone, trigger: t.id, name: t.name[locale], icon: t.icon, zoneName: zoneName(e.zone) });
    } else if (e.type === 'eventCancelled') {
      eventChanges.push({ event: e.event, name: eventName(e.event), change: 'cancelled' });
    } else if (e.type === 'eventDelayed') {
      eventChanges.push({ event: e.event, name: eventName(e.event), change: 'delayed', round: e.round });
    }
  }
  if (sim.eventShield > state.eventShield) eventChanges.push({ event: null, name: null, change: 'shielded' });
  const formChanges: Preview['formChanges'] = [];
  sim.zones.forEach((z, i) => {
    const to = formFor(data, sim, z);
    const from = state.zones[i]!.form;
    if (to.id !== from)
      formChanges.push({
        zone: z.id,
        from,
        to: to.id,
        zoneName: zoneName(z.id),
        fromName: formName(from),
        toName: to.name[locale],
        kind: to.kind,
      });
  });
  // Richtung zum Zielbereich der Idealform und Abstand der betroffenen Zonen (nur Karteneffekt, ohne Natur-Phase).
  const changed = [...changes.values()].filter((c) => c.from !== c.to);
  for (const c of changed) {
    const range = data.ideals.get(getZone(state, c.zone).geography)?.ranges[c.stat];
    const delta = range ? statDistance(range, c.to) - statDistance(range, c.from) : 0;
    c.toward = delta < 0 ? 'better' : delta > 0 ? 'worse' : 'neutral';
  }
  const idealDistances: NonNullable<Preview['idealDistance']> = [];
  for (const zid of new Set(changed.map((c) => c.zone))) {
    const before = getZone(state, zid);
    const ideal = data.ideals.get(before.geography);
    if (ideal)
      idealDistances.push({
        zone: zid,
        before: idealDistance(ideal, before.stats),
        after: idealDistance(ideal, getZone(sim, zid).stats),
      });
  }
  return {
    cost: card.cost,
    affordable: card.cost <= state.breath,
    changes: changed,
    idealDistance: idealDistances,
    triggers,
    formChanges,
    populationChanges: [...pops.values()].filter((c) => c.from !== c.to),
    eventChanges,
  };
}
