/** Lesemodell für Oberflächen: Insel, Herde, Rudel, Absicht, Hand mit Zielen, Wildnis, Eiszeit, Ende. */
import type { CellForecast, HerdeView, IntentView } from './api.ts';
import { getCard, targetsOf } from './cards.ts';
import { chooseMove } from './herd.ts';
import { runNature } from './nature.ts';
import type { HerdeData } from './schema.ts';
import type { CellState, HerdeState } from './state.ts';
import { islandOf, landOf, maxFood, seasonOf, stageOf, yearLength } from './world.ts';

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
        maxFood: maxFood(data, c),
        fertile: c.fertile > 0 && l.fertileBonus > 0,
        walkable: l.walk,
        forecast: forecastOf(data, s, c),
        wildfire: l.fireChance > 0,
        herd: s.herd.x === x && s.herd.y === y,
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
    over: s.over,
  };
}
