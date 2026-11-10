/**
 * Fassade der Herde-Engine: newGame, step, view, legalPlays, legalActions, validateState.
 * `step` ist rein: Der Eingangszustand wird nie verändert, Zufall läuft über den Seed im Zustand.
 */
import type { Action, NewGameOptions, StepResult } from './api.ts';
import { campSites, settle } from './camp.ts';
import { drawCard, getCard, playCard, targetsOf } from './cards.ts';
import { advance } from './month.ts';
import { nextInt, seedFrom, type RngHolder } from './rng.ts';
import type { HerdeData } from './schema.ts';
import { STATE_VERSION, type CellState, type HerdeEvent, type HerdeState } from './state.ts';
import { evolve, maturityOf, pickTrait } from './traits.ts';
import { RuleError } from './world.ts';

export { view, intentOf, forecastOf, evolutionOf } from './view.ts';
export { campPreview } from './camp.ts';
export { validateState } from './validate.ts';

const rand = (h: RngHolder, n: number) => (n > 0 ? nextInt(h, n) : 0);

/** Neue Partie auf einer Insel; Startfelder, Rudel und Starthand aus den Daten, Zufall aus dem Seed. */
export function newGame(data: HerdeData, options: NewGameOptions): HerdeState {
  const islandId = options.island ?? data.islands.keys().next().value!;
  const island = data.islands.get(islandId);
  if (!island) throw new RuleError(`Unbekannte Insel: ${islandId}`);
  const p = data.params;
  const seed = seedFrom(options.seed);
  const s: HerdeState = {
    version: STATE_VERSION,
    seed,
    rng: seed,
    island: island.id,
    month: 0,
    ice: 0,
    wild: p.wild.start,
    over: null,
    cells: [],
    herd: {
      stage: p.herd.stage,
      x: island.herd.x,
      y: island.herd.y,
      size: p.herd.size,
      fat: p.herd.fat,
      thirst: 0,
      trail: [],
      traits: [],
      traitsAtStage: 0,
      experience: Object.fromEntries([...data.experiences.keys()].map((id) => [id, 0])),
      offer: [],
      offerTurn: 0,
    },
    packs: [],
    nextPackId: 1,
    prey: [],
    nextPreyId: 1,
    camp: null,
    iceAges: 0,
    hand: [],
  };
  // Startfelder Zeile für Zeile; Zufall je Feld in der Reihenfolge Futter, Beweidung, Alter (wie im Prototyp).
  for (const land of island.cells) {
    const start = data.landscapes.get(land)!.start;
    const cell: CellState = { land, food: 0, age: 0, fertile: 0, grazed: 0 };
    if (start) {
      cell.food = start.food + rand(s, start.foodRandom);
      const ungrazed = rand(s, start.ungrazedRandom);
      cell.grazed = ungrazed === 0 ? 0 : -ungrazed;
      cell.age = rand(s, start.ageRandom);
    }
    s.cells.push(cell);
  }
  for (const pack of island.packs) s.packs.push({ id: s.nextPackId++, ...pack, fed: 0, hungry: 0 });
  for (let i = 0; i < p.cards.startHand; i++) s.hand.push(drawCard(data, s));
  return s;
}

/**
 * Eine Aktion ausführen: Karte ausspielen, einen Monat weiter, Merkmal wählen, zur nächsten Stufe springen oder ein
 * Lager gründen.
 * Wirft RuleError bei ungültigen Zügen.
 */
export function step(data: HerdeData, state: HerdeState, action: Action): StepResult {
  if (state.over) throw new RuleError('Die Partie ist vorbei.');
  const next = structuredClone(state);
  const events: HerdeEvent[] = [];
  const emit = (e: HerdeEvent) => events.push(e);
  switch (action.type) {
    case 'play':
      playCard(data, next, action.hand, { x: action.x, y: action.y }, emit);
      break;
    case 'advance':
      advance(data, next, emit);
      break;
    case 'pickTrait':
      pickTrait(data, next, action.trait, emit);
      break;
    case 'evolve':
      evolve(data, next, emit);
      break;
    case 'settle':
      settle(data, next, { x: action.x, y: action.y }, emit);
      break;
    default:
      throw new RuleError(`Unbekannte Aktion: ${(action as { type: unknown }).type}`);
  }
  return { state: next, events };
}

/** Alle gültigen Kartenzüge (je Handkarte und Zielfeld; globale Karten ohne Feld). `advance` ist immer möglich. */
export function legalPlays(data: HerdeData, state: HerdeState): Action[] {
  if (state.over) return [];
  const out: Action[] = [];
  state.hand.forEach((id, hand) => {
    const card = getCard(data, id);
    if (card.global) out.push({ type: 'play', hand });
    else for (const t of targetsOf(data, state, card)) out.push({ type: 'play', hand, x: t.x, y: t.y });
  });
  return out;
}

/**
 * Alle gültigen Aktionen: Kartenzüge (wie `legalPlays`), jedes angebotene Merkmal, der Sprung (wenn reif), jeder
 * gültige Lagerplatz (`settle`) und `advance`. Leer, wenn die Partie vorbei ist.
 */
export function legalActions(data: HerdeData, state: HerdeState): Action[] {
  if (state.over) return [];
  const out = legalPlays(data, state);
  for (const trait of state.herd.offer) out.push({ type: 'pickTrait', trait });
  if (maturityOf(data, state).mature) out.push({ type: 'evolve' });
  for (const p of campSites(data, state)) out.push({ type: 'settle', x: p.x, y: p.y });
  out.push({ type: 'advance' });
  return out;
}
