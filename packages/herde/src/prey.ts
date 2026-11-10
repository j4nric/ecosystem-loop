/**
 * Wild (Beutetiere, Konzept 9.2): Bestände ohne Kampf. Fressen, Wachsen/Gründen, Schrumpfen, Ziehen und Einwandern.
 * Läuft nach den Wölfen (Schritt 7). Ohne Zufall außer beim Einwandern.
 */
import { nextFloat, pick } from './rng.ts';
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, Pos, PreyState } from './state.ts';
import { around, cellAt, islandOf, samePos, stageReached } from './world.ts';

const habitat = (data: HerdeData, s: HerdeState, p: Pos) =>
  data.params.prey.lands.includes(cellAt(data, s, p.x, p.y).land);
/** Weide eines Felds: Futter, das Wild von dort fressen könnte (Feld und Nachbarfelder, Landschaften aus prey.eats). */
function pasture(data: HerdeData, s: HerdeState, p: Pos): number {
  return around(islandOf(data, s), p.x, p.y).reduce((a, q) => {
    const c = cellAt(data, s, q.x, q.y);
    return data.params.prey.eats.includes(c.land) ? a + c.food : a;
  }, 0);
}

/**
 * Freies Feld des Lebensraums im Umkreis r (ohne das eigene) mit der meisten Weide (`pasture`); bei Gleichstand das
 * erste (Zeile für Zeile). `min`: nur Felder mit mehr Weide als dieser Wert.
 */
function bestSpot(data: HerdeData, s: HerdeState, from: Pos, r: number, taken: readonly Pos[], min = -1): Pos | null {
  let best: Pos | null = null;
  let most = min;
  for (const q of around(islandOf(data, s), from.x, from.y, r)) {
    if (samePos(q, from) || !habitat(data, s, q) || taken.some((o) => samePos(o, q))) continue;
    const f = pasture(data, s, q);
    if (f > most) {
      best = q;
      most = f;
    }
  }
  return best;
}

/** Ein Bestand frisst auf seinem Feld und den Nachbarfeldern (die vollsten zuerst). Liefert, ob er satt ist. */
function graze(data: HerdeData, s: HerdeState, q: PreyState): boolean {
  const need = q.size * data.params.prey.food;
  const spots = around(islandOf(data, s), q.x, q.y)
    .map((p) => cellAt(data, s, p.x, p.y))
    .filter((c) => data.params.prey.eats.includes(c.land))
    .sort((a, b) => b.food - a.food);
  let eaten = 0;
  for (const c of spots) {
    if (eaten >= need) break;
    const take = Math.min(c.food, need - eaten);
    c.food -= take;
    eaten += take;
  }
  return eaten >= need;
}

/**
 * Leben der Wildbestände (in Reihenfolge des Zustands): fressen; satt → nach `fedToGrow` Monaten wachsen bzw. in
 * voller Größe einen neuen Bestand auf dem freien Nachbarfeld im Lebensraum mit der meisten Weide gründen; nicht satt
 * → auf das freie Nachbarfeld im Lebensraum mit der meisten Weide ziehen (wenn sie größer ist als hier) und nach `starveAfter`
 * Monaten um 1 schrumpfen (bei 0 verschwindet der Bestand).
 */
export function preyLife(data: HerdeData, s: HerdeState, emit: Emit): void {
  const w = data.params.prey;
  const born: PreyState[] = [];
  for (const q of s.prey) {
    const taken = () => [...s.prey, ...born].filter((o) => o !== q);
    // AUSLEGUNG: Die Beweidungs-Uhr der Wiese (Verbuschung) läuft durch Wild weiter – nur die Herde hält Wiese offen.
    if (graze(data, s, q)) {
      q.hungry = 0;
      if (++q.fed >= w.fedToGrow) {
        q.fed = 0;
        if (q.size < w.maxSize) {
          q.size++;
          emit({ type: 'preyGrew', prey: q.id, size: q.size });
        } else {
          const spot = bestSpot(data, s, q, 1, taken());
          if (spot) {
            const n = { id: s.nextPreyId++, x: spot.x, y: spot.y, size: 1, fed: 0, hungry: 0 };
            born.push(n);
            emit({ type: 'preyFounded', prey: n.id, parent: q.id, x: n.x, y: n.y });
          }
        }
      }
      continue;
    }
    q.fed = 0;
    const to = bestSpot(data, s, q, 1, taken(), habitat(data, s, q) ? pasture(data, s, q) : -1);
    if (to) {
      const from = { x: q.x, y: q.y };
      q.x = to.x;
      q.y = to.y;
      emit({ type: 'preyMoved', prey: q.id, from, to: { x: to.x, y: to.y } });
    }
    if (++q.hungry >= w.starveAfter) {
      q.hungry = 0;
      q.size--;
      emit({ type: 'preyStarved', prey: q.id, size: q.size });
    }
  }
  s.prey = s.prey.filter((q) => q.size > 0).concat(born);
}

/**
 * Ohne Wild wandert mit `spawnChance` ein Bestand (`spawnSize`) auf ein Feld des Lebensraums ein – erst, wenn die
 * Herde die Stufe `prey.from` erreicht hat, und nur bei mindestens `spawnMinLand` Feldern im Lebensraum.
 */
export function immigratePrey(data: HerdeData, s: HerdeState, emit: Emit): void {
  const w = data.params.prey;
  // AUSLEGUNG: Vor `prey.from` wird nicht einmal gewürfelt – so bleibt der Zufallsstrom der Startphase genau wie im
  // Prototyp (Gleichheitstest).
  if (s.prey.length > 0 || !stageReached(data, s, w.from)) return;
  const { width } = islandOf(data, s);
  const spots: Pos[] = [];
  s.cells.forEach((c, i) => {
    if (w.lands.includes(c.land)) spots.push({ x: i % width, y: Math.floor(i / width) });
  });
  if (spots.length < w.spawnMinLand || spots.length === 0 || nextFloat(s) >= w.spawnChance) return;
  const p = pick(s, spots);
  const q = { id: s.nextPreyId++, x: p.x, y: p.y, size: w.spawnSize, fed: 0, hungry: 0 };
  s.prey.push(q);
  emit({ type: 'preyImmigrated', prey: q.id, x: q.x, y: q.y, size: q.size });
}
