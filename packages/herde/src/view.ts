/**
 * Lesemodell für Oberflächen: Insel, Herde, Rudel, Absicht, Hand mit Zielen, Wildnis, Eiszeit, Entwicklung, Ende.
 */
import type { CellForecast, EvolutionView, HerdeView, IntentView, StageNeedsView } from './api.ts';
import { getCard, targetsOf } from './cards.ts';
import { chooseMove } from './herd.ts';
import { runNature } from './nature.ts';
import type { HerdeData, SeasonSet } from './schema.ts';
import type { CellState, HerdeState } from './state.ts';
import { availableTraits, maturityOf } from './traits.ts';
import { islandOf, landOf, maxFood, seasonOf, stageOf, walkable, yearLength } from './world.ts';

/**
 * Absicht der Herde: Die Herde wählt nach Wachstum, Sukzession und Waldbrand dieses Monats (Schritte 1–3).
 * Dafür laufen diese Schritte auf einer Kopie – mit demselben Seed-Zufall, also genau wie in `advance`.
 * AUSLEGUNG: So zeigt `view` dieselbe Absicht, die `advance` ausführt (im Prototyp wird die angezeigte Absicht
 * vor dem Wachstum berechnet, die ausgeführte danach). Folge: Ein Waldbrand im nächsten Monat kann sich in der
 * Absicht schon andeuten (siehe offene Fragen im README).
 */
export function intentOf(data: HerdeData, s: HerdeState): IntentView | null {
  if (s.over) return null;
  const sim = structuredClone(s);
  runNature(data, sim, () => {});
  const go = chooseMove(data, sim);
  const dx = go.x - s.herd.x;
  const dy = go.y - s.herd.y;
  return { x: go.x, y: go.y, dx, dy, stays: dx === 0 && dy === 0, reason: go.reason };
}

/** Prognose der Sukzession eines Felds. */
export function forecastOf(data: HerdeData, s: HerdeState, c: CellState): CellForecast | null {
  const rule = landOf(data, c).succession;
  if (!rule) return null;
  // Die Uhr wird im Monatsschritt geprüft: „age“ nach dem Hochzählen, „ungrazed“ vor dem Fressen.
  // AUSLEGUNG: genaue Zahl der Monatsschritte; der Prototyp zeigt bei „ungrazed“ einen Monat weniger an.
  const inMonths = rule.clock === 'age' ? rule.months - c.age : rule.months - (s.month - c.grazed) + 1;
  return { to: rule.to, inMonths: Math.max(1, inMonths), clock: rule.clock, fertile: (rule.fertile ?? 0) > 0 };
}

/** Bedürfnisse einer Stufe; mit dem Zustand der Herde inklusive der Wirkung ihrer Merkmale auf Schritte und Umkreis. */
export function stageNeeds(data: HerdeData, s: HerdeState, stageId: string): StageNeedsView {
  const sim: HerdeState = { ...s, herd: { ...s.herd, stage: stageId } };
  const stage = stageOf(data, sim);
  const seasons = (set: SeasonSet) => (set === 'all' ? data.seasons.map((x) => x.id) : [...set]);
  const food: Record<string, number> = {};
  for (const id of stage.eats) food[id] = stage.forage[id]?.food ?? data.landscapes.get(id)!.food;
  return {
    id: stage.id,
    eats: [...stage.eats],
    food,
    water: [...stage.water],
    waterSeasons: seasons(stage.needs.water),
    shelter: [...stage.shelter],
    shelterSeasons: seasons(stage.needs.shelter),
    blocked: [...stage.blocked],
    move: stage.move,
    reach: stage.reach,
  };
}

/** Entwicklung: Stufe, Merkmale, Angebot, Fortschritt der Erfahrungen, Reife, Vorschau der nächsten Stufe. */
export function evolutionOf(data: HerdeData, s: HerdeState): EvolutionView {
  const m = maturityOf(data, s);
  const experience = [...data.experiences.values()].map((e) => {
    const value = s.herd.experience[e.id] ?? 0;
    let next: { trait: string; at: number } | null = null;
    for (const t of data.traits.values())
      if (t.from === e.id && t.at > value && !s.herd.traits.includes(t.id) && (!next || t.at < next.at))
        next = { trait: t.id, at: t.at };
    return { id: e.id, value, next };
  });
  return {
    stage: stageNeeds(data, s, s.herd.stage),
    traits: [...s.herd.traits],
    offer: [...s.herd.offer],
    available: availableTraits(data, s),
    experience,
    mature: m.mature && !s.over,
    missing: m.next === null ? null : { traits: m.missingTraits, oneOf: m.missingOneOf },
    next: m.next === null ? null : stageNeeds(data, s, m.next),
  };
}

export function view(data: HerdeData, s: HerdeState): HerdeView {
  const island = islandOf(data, s);
  const stage = stageOf(data, s);
  const year = yearLength(data);
  return {
    island: s.island,
    width: island.width,
    height: island.height,
    month: s.month,
    year: Math.floor(s.month / year) + 1,
    monthOfYear: s.month % year,
    season: seasonOf(data, s).id,
    ice: { active: s.ice > 0, monthsLeft: s.ice, months: data.params.ice.months },
    wild: { value: s.wild, max: data.params.wild.max },
    cells: s.cells.map((c, i) => {
      const x = i % island.width;
      const y = Math.floor(i / island.width);
      const l = landOf(data, c);
      return {
        x,
        y,
        land: c.land,
        food: c.food,
        maxFood: maxFood(data, s, c),
        fertile: c.fertile > 0 && l.fertileBonus > 0,
        walkable: l.walk,
        forecast: forecastOf(data, s, c),
        wildfire: l.fireChance > 0,
        herd: s.herd.x === x && s.herd.y === y,
        blocked: l.walk && !walkable(data, s, c.land),
        pack: s.packs.find((p) => p.x === x && p.y === y)?.id ?? null,
      };
    }),
    herd: {
      stage: s.herd.stage,
      x: s.herd.x,
      y: s.herd.y,
      size: s.herd.size,
      fat: s.herd.fat,
      fatMax: s.herd.size * stage.fatCap,
      thirst: s.herd.thirst,
    },
    packs: s.packs.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      size: p.size,
      hungry: p.hungry >= data.params.wolves.hungryAfter,
    })),
    intent: intentOf(data, s),
    hand: s.hand.map((id, index) => {
      const card = getCard(data, id);
      return { index, card: id, global: card.global, wild: card.wild, targets: s.over ? [] : targetsOf(data, s, card) };
    }),
    handMax: data.params.cards.handMax,
    evolution: evolutionOf(data, s),
    over: s.over,
  };
}
