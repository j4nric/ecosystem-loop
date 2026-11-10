/**
 * Die Herde (Konzept 5): Wahl des nächsten Felds (Absicht), Fressen und Vorrat, Durst, Kälte, Feuer, Nachwuchs.
 * Alle Bedürfnisse kommen aus der Stufe der Herde (stages.yaml).
 */
import type { HerdeData, Stage } from './schema.ts';
import type { Emit, HerdeState, Pos, ReasonId } from './state.ts';
import {
  around,
  cellAt,
  freshBurnNear,
  islandOf,
  near,
  needsNow,
  packsNear,
  preyNear,
  reachable,
  samePos,
  stageOf,
} from './world.ts';

export interface Intent extends Pos {
  reason: ReasonId;
  score: number;
}

/** Futter, das die Herde in einem Monat höchstens frisst (Bedarf × eatFactor, aufgerundet). */
export function appetite(data: HerdeData, s: HerdeState): number {
  const stage = stageOf(data, s);
  return Math.ceil(s.herd.size * stage.foodPerAnimal * stage.eatFactor);
}

/** Jagd von einem Feld aus: höchstens so viele Wild-Tiere (huntKill, + fireHunt bei frischer Brandfläche). */
export function huntLimit(data: HerdeData, s: HerdeState, stage: Stage, p: Pos): { kill: number; fire: boolean } {
  if (stage.preyFood <= 0) return { kill: 0, fire: false };
  const fire = stage.fireHunt > 0 && freshBurnNear(data, s, p, stage.reach);
  return { kill: stage.huntKill + (fire ? stage.fireHunt : 0), fire };
}

/**
 * Wohin will die Herde? Bewertet alle Felder, die sie in diesem Monat erreichen kann (Stufe: `move` Schritte über
 * begehbare, nicht gesperrte Felder; Stufe 1: das eigene und die 8 Nachbarfelder): Futter im Umkreis `reach`
 * (gedeckelt auf den Fressbedarf), Wasser bzw. Schutz in der Nähe, wenn die Stufe sie in dieser Jahreszeit braucht,
 * abzüglich Wölfen in der Nähe und kürzlich besuchter Felder; das eigene Feld bekommt einen kleinen Bonus.
 * Ohne Zufall: Bei Gleichstand gewinnt das erste Feld (Zeile für Zeile von oben links).
 */
export function chooseMove(data: HerdeData, s: HerdeState): Intent {
  const h = s.herd;
  // Sesshaft: Mit einem Lager zieht die Herde nicht mehr.
  if (s.camp) return { x: h.x, y: h.y, score: 0, reason: 'settled' };
  const stage = stageOf(data, s);
  const island = islandOf(data, s);
  const w = stage.choice;
  const want = appetite(data, s);
  const needWater = needsNow(data, s, 'water');
  const needShelter = needsNow(data, s, 'shelter');
  let best: (Intent & { water: number; shelter: number; wolves: number }) | null = null;
  for (const p of reachable(data, s, h, stage.move)) {
    const plants = around(island, p.x, p.y, stage.reach).reduce((a, q) => {
      const c = cellAt(data, s, q.x, q.y);
      return stage.eats.includes(c.land) ? a + c.food : a;
    }, 0);
    // Jagd: erlegbare Tiere im Umkreis × Futter je Tier (Stufen ohne Jagd: 0)
    const kill = huntLimit(data, s, stage, p).kill;
    const units = kill > 0 ? preyNear(s, p, stage.reach).reduce((a, q) => a + q.size, 0) : 0;
    const reach = plants + Math.min(kill, units) * stage.preyFood;
    const food = Math.min(want, reach) * w.food;
    const water = needWater && near(data, s, p.x, p.y, stage.water, stage.reach) ? h.size * w.water : 0;
    const shelter = needShelter && near(data, s, p.x, p.y, stage.shelter, stage.reach) ? h.size * w.shelter : 0;
    const wolves = packsNear(s, p.x, p.y) * h.size * w.wolves;
    const recent = h.trail.some((t) => samePos(t, p)) ? h.size * w.recent : 0;
    const stay = samePos(p, h) ? w.stay : 0;
    const score = food + water + shelter - wolves - recent + stay;
    if (!best || score > best.score) best = { x: p.x, y: p.y, score, water, shelter, wolves, reason: 'stay' };
  }
  // AUSLEGUNG: Das eigene Feld ist immer eine Wahl – auch wenn die Stufe es nicht betreten würde (z. B. Altwald
  // nach dem Sprung zum Wanderer); die Herde kann also immer bleiben oder es verlassen.
  if (!best) return { x: h.x, y: h.y, score: 0, reason: 'stay' };
  const wolvesHere = packsNear(s, h.x, h.y);
  let reason: ReasonId = 'stay';
  if (wolvesHere > 0 && best.wolves < wolvesHere * h.size * w.wolves) reason = 'avoidWolves';
  else if (best.water > 0 && !near(data, s, h.x, h.y, stage.water, stage.reach)) reason = 'seekWater';
  else if (best.shelter > 0 && !near(data, s, h.x, h.y, stage.shelter, stage.reach)) reason = 'seekShelter';
  else if (!samePos(best, h)) reason = 'freshGrass';
  return { x: best.x, y: best.y, score: best.score, reason };
}

/** 4. Die Herde zieht (höchstens `move` Felder) und merkt sich das verlassene Feld. */
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
 * 5. Fressen im Umkreis `reach` (Stufe 1: das eigene und die 8 Nachbarfelder), die vollsten zuerst, bis zum Appetit. Überschuss über den
 * Bedarf wird Vorrat (gedeckelt), Mangel zehrt ihn auf, danach sterben Tiere. Liefert die Toten.
 */
export function eat(data: HerdeData, s: HerdeState, emit: Emit): number {
  const h = s.herd;
  const stage = stageOf(data, s);
  const need = h.size * stage.foodPerAnimal;
  const want = appetite(data, s);
  const spots = around(islandOf(data, s), h.x, h.y, stage.reach)
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
  // Jagd nach den Pflanzen: Wild im Umkreis, die größten Bestände zuerst (bei Gleichstand in Reihenfolge des Zustands).
  const hunt = huntLimit(data, s, stage, h);
  if (hunt.kill > 0 && eaten < want) {
    let left = hunt.kill;
    const targets = preyNear(s, h, stage.reach).sort((a, b) => b.size - a.size);
    for (const q of targets) {
      let killed = 0;
      while (left > 0 && q.size > 0 && eaten < want) {
        q.size--;
        left--;
        killed++;
        eaten += Math.min(stage.preyFood, want - eaten);
      }
      if (killed > 0) emit({ type: 'preyHunted', prey: q.id, killed, size: q.size, fire: hunt.fire });
    }
    s.prey = s.prey.filter((q) => q.size > 0);
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

/**
 * 6. Durst (ab thirstAfter Monaten ohne Wasser) und Kälte, jeweils nur in den Jahreszeiten, in denen die Stufe
 * Wasser bzw. Schutz braucht (stages.yaml → needs). Liefert die Toten.
 */
export function needs(data: HerdeData, s: HerdeState, emit: Emit): number {
  const h = s.herd;
  const stage = stageOf(data, s);
  let dead = 0;
  if (needsNow(data, s, 'water')) {
    if (near(data, s, h.x, h.y, stage.water, stage.reach)) h.thirst = 0;
    else if (++h.thirst >= stage.thirstAfter) {
      const d = Math.ceil(h.size * stage.thirstLoss);
      dead += d;
      emit({ type: 'herdThirsted', dead: d });
    }
  } else h.thirst = 0;
  if (needsNow(data, s, 'shelter') && !near(data, s, h.x, h.y, stage.shelter, stage.reach)) {
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
  // Ohne Feuerverlust (Jäger: Feuer ist Werkzeug) ist es kein Schaden: kein Ereignis.
  if (dead <= 0) return 0;
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
