/**
 * Die Herde (Konzept 5): Wahl des nächsten Felds (Absicht), Fressen und Vorrat, Durst, Kälte, Feuer, Nachwuchs.
 * Alle Bedürfnisse kommen aus der Stufe der Herde (stages.yaml).
 */
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos, ReasonId } from './state.ts';
import { around, cellAt, islandOf, landOf, near, packsNear, samePos, seasonOf, stageOf } from './world.ts';

export interface Intent extends Pos {
  reason: ReasonId;
  score: number;
}

/** Futter, das die Herde in einem Monat höchstens frisst (Bedarf × eatFactor, aufgerundet). */
export function appetite(data: HerdeData, s: HerdeState): number {
  const stage = stageOf(data, s);
  return Math.ceil(s.herd.size * stage.foodPerAnimal * stage.eatFactor);
}

/**
 * Wohin will die Herde? Bewertet das eigene und die 8 Nachbarfelder (nur begehbare): Futter in Reichweite
 * (gedeckelt auf den Fressbedarf), in Wasser-Jahreszeiten Wasser, in Schutz-Jahreszeiten Schutz in der Nähe,
 * abzüglich Wölfen in der Nähe und kürzlich besuchter Felder; das eigene Feld bekommt einen kleinen Bonus.
 * Ohne Zufall: Bei Gleichstand gewinnt das erste Feld (Zeile für Zeile von oben links).
 */
export function chooseMove(data: HerdeData, s: HerdeState): Intent {
  const h = s.herd;
  const stage = stageOf(data, s);
  const season = seasonOf(data, s);
  const island = islandOf(data, s);
  const w = stage.choice;
  const want = appetite(data, s);
  let best: (Intent & { water: number; shelter: number; wolves: number }) | null = null;
  for (const p of around(island, h.x, h.y)) {
    if (!landOf(data, cellAt(data, s, p.x, p.y)).walk) continue;
    const reach = around(island, p.x, p.y).reduce((a, q) => {
      const c = cellAt(data, s, q.x, q.y);
      return stage.eats.includes(c.land) ? a + c.food : a;
    }, 0);
    const food = Math.min(want, reach) * w.food;
    const water = season.water && near(data, s, p.x, p.y, stage.water) ? h.size * w.water : 0;
    const shelter = season.shelter && near(data, s, p.x, p.y, stage.shelter) ? h.size * w.shelter : 0;
    const wolves = packsNear(s, p.x, p.y) * h.size * w.wolves;
    const recent = h.trail.some((t) => samePos(t, p)) ? h.size * w.recent : 0;
    const stay = samePos(p, h) ? w.stay : 0;
    const score = food + water + shelter - wolves - recent + stay;
    if (!best || score > best.score) best = { x: p.x, y: p.y, score, water, shelter, wolves, reason: 'stay' };
  }
  // Das eigene Feld ist immer begehbar (Fels nie auf die Herde); fehlt es doch, bleibt sie stehen.
  if (!best) return { x: h.x, y: h.y, score: 0, reason: 'stay' };
  const wolvesHere = packsNear(s, h.x, h.y);
  let reason: ReasonId = 'stay';
  if (wolvesHere > 0 && best.wolves < wolvesHere * h.size * w.wolves) reason = 'avoidWolves';
  else if (best.water > 0 && !near(data, s, h.x, h.y, stage.water)) reason = 'seekWater';
  else if (best.shelter > 0 && !near(data, s, h.x, h.y, stage.shelter)) reason = 'seekShelter';
  else if (!samePos(best, h)) reason = 'freshGrass';
  return { x: best.x, y: best.y, score: best.score, reason };
}

/** 4. Die Herde zieht (höchstens ein Feld) und merkt sich das verlassene Feld. */
export function moveHerd(data: HerdeData, s: HerdeState, emit: Emit): void {
  const h = s.herd;
  const go = chooseMove(data, s);
  const from = { x: h.x, y: h.y };
  h.trail.push(from);
  while (h.trail.length > stageOf(data, s).trail) h.trail.shift();
  h.x = go.x;
  h.y = go.y;
  emit({ type: 'herdMoved', from, to: { x: go.x, y: go.y }, reason: go.reason });
}

/**
 * 5. Fressen aus dem eigenen und den 8 Nachbarfeldern, die vollsten zuerst, bis zum Appetit. Überschuss über den
 * Bedarf wird Vorrat (gedeckelt), Mangel zehrt ihn auf, danach sterben Tiere. Liefert die Toten.
 */
export function eat(data: HerdeData, s: HerdeState, emit: Emit): number {
  const h = s.herd;
  const stage = stageOf(data, s);
  const need = h.size * stage.foodPerAnimal;
  const want = appetite(data, s);
  const spots = around(islandOf(data, s), h.x, h.y)
    .map((p) => cellAt(data, s, p.x, p.y))
    .filter((c) => stage.eats.includes(c.land))
    .sort((a, b) => b.food - a.food);
  let eaten = 0;
  for (const c of spots) {
    if (eaten >= want) break;
    const take = Math.min(c.food, want - eaten);
    if (take > 0) {
      c.food -= take;
      eaten += take;
      c.grazed = s.month;
    }
  }
  let dead = 0;
  if (eaten >= need) h.fat = Math.min(h.size * stage.fatCap, h.fat + eaten - need);
  else {
    const deficit = need - eaten;
    if (h.fat >= deficit) h.fat -= deficit;
    else {
      dead = Math.ceil((deficit - h.fat) * stage.starveRate);
      h.fat = 0;
    }
  }
  emit({ type: 'herdAte', eaten, need, fat: h.fat });
  if (dead > 0) emit({ type: 'herdStarved', dead });
  return dead;
}

/** 6. Durst (Wasser-Jahreszeit, ab thirstAfter Monaten ohne Wasser) und Kälte (Schutz-Jahreszeit). Liefert die Toten. */
export function needs(data: HerdeData, s: HerdeState, emit: Emit): number {
  const h = s.herd;
  const stage = stageOf(data, s);
  const season = seasonOf(data, s);
  let dead = 0;
  if (season.water) {
    if (near(data, s, h.x, h.y, stage.water)) h.thirst = 0;
    else if (++h.thirst >= stage.thirstAfter) {
      const d = Math.ceil(h.size * stage.thirstLoss);
      dead += d;
      emit({ type: 'herdThirsted', dead: d });
    }
  } else h.thirst = 0;
  if (season.shelter && !near(data, s, h.x, h.y, stage.shelter)) {
    const d = Math.ceil(h.size * stage.coldLoss);
    dead += d;
    emit({ type: 'herdFroze', dead: d });
  }
  return dead;
}

/** Brennt das Feld der Herde in diesem Monat, verliert sie Tiere. Liefert die Toten. */
export function herdInFire(data: HerdeData, s: HerdeState, burned: Pos[], emit: Emit): number {
  if (!burned.some((p) => samePos(p, s.herd))) return 0;
  const dead = Math.ceil(s.herd.size * stageOf(data, s).fireLoss);
  emit({ type: 'herdBurned', dead });
  return dead;
}

/** Tote abziehen, Vorrat an die neue Größe anpassen. */
export function applyDeaths(data: HerdeData, s: HerdeState, dead: number): void {
  const h = s.herd;
  h.size = Math.max(0, h.size - dead);
  h.fat = Math.min(h.fat, h.size * stageOf(data, s).fatCap);
}

/** 8. Nachwuchs im Geburtsmonat (nicht in der Eiszeit), je nach Vorrat. */
export function births(data: HerdeData, s: HerdeState, emit: Emit): void {
  const h = s.herd;
  const year = data.seasons.length * data.monthsPerSeason;
  if (s.ice > 0 || s.month % year !== data.params.herd.birthMonth || h.size <= 0) return;
  const born = Math.floor(h.size * stageOf(data, s).birthRate * Math.min(1, h.fat / h.size));
  if (born <= 0) return;
  h.size += born;
  h.fat = Math.max(0, h.fat - born);
  emit({ type: 'herdBorn', born });
}
