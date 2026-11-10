/**
 * Wölfe (Konzept 6): Reißen, Wandern durchs Gehölz, Wachsen, Gründen, Verhungern, Einwandern.
 * Schritt 7 eines Monats.
 */
import { nextFloat, pick } from './rng.ts';
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, PackState, Pos } from './state.ts';
import { around, cellAt, cheb, islandOf, landOf, samePos } from './world.ts';

const isWood = (data: HerdeData, s: HerdeState, p: Pos) => landOf(data, cellAt(data, s, p.x, p.y)).wood;

/** Rudel in Reichweite (Umkreis 1) reißen Tiere, je Rudel so viele wie seine Stärke. Liefert die Gerissenen. */
export function hunt(s: HerdeState, deadSoFar: number, emit: Emit): number {
  let killed = 0;
  for (const p of s.packs) {
    const alive = s.herd.size - deadSoFar - killed;
    if (cheb(p, s.herd) <= 1 && alive > 0) {
      const k = Math.min(p.size, alive);
      killed += k;
      p.fed += k;
      p.hungry = 0;
      emit({ type: 'wolvesHunted', pack: p.id, killed: k });
    } else p.hungry++;
  }
  return killed;
}

/** Hungrige Rudel ziehen ein Feld durchs Gehölz auf die Herde zu (nur auf freie Gehölz-Felder, die näher liegen). */
export function roam(data: HerdeData, s: HerdeState, emit: Emit): void {
  const island = islandOf(data, s);
  for (const p of s.packs) {
    if (p.hungry < data.params.wolves.hungryAfter) continue;
    const dist = cheb(p, s.herd);
    let best: (Pos & { d: number }) | null = null;
    for (const q of around(island, p.x, p.y)) {
      if (!isWood(data, s, q) || s.packs.some((o) => o !== p && samePos(o, q))) continue;
      const d = cheb(q, s.herd);
      if (d < dist && (!best || d < best.d)) best = { ...q, d };
    }
    if (best) {
      const from = { x: p.x, y: p.y };
      p.x = best.x;
      p.y = best.y;
      emit({ type: 'packMoved', pack: p.id, from, to: { x: p.x, y: p.y } });
    }
  }
}

/**
 * Satte Rudel wachsen (in voller Stärke gründen sie ein neues Rudel im Gehölz in der Nähe), hungrige verkümmern.
 * Rudel ohne Stärke oder außerhalb des Gehölzes verschwinden.
 */
export function packLife(data: HerdeData, s: HerdeState, emit: Emit): void {
  const w = data.params.wolves;
  const island = islandOf(data, s);
  const born: PackState[] = [];
  for (const p of s.packs) {
    if (p.fed >= w.fedToGrow) {
      p.fed -= w.fedToGrow;
      if (p.size < w.maxSize) {
        p.size++;
        emit({ type: 'packGrew', pack: p.id, size: p.size });
      } else {
        // AUSLEGUNG: Auch Felder, auf denen sich in diesem Monat schon ein Rudel gegründet hat, sind besetzt.
        // Der Prototyp prüft nur die bestehenden Rudel; zwei neue Rudel könnten dort auf einem Feld landen.
        const spots = around(island, p.x, p.y, w.foundRadius).filter(
          (q) => isWood(data, s, q) && !s.packs.some((o) => samePos(o, q)) && !born.some((o) => samePos(o, q)),
        );
        if (spots.length > 0) {
          const q = pick(s, spots);
          const pack = { id: s.nextPackId++, x: q.x, y: q.y, size: 1, fed: 0, hungry: 0 };
          born.push(pack);
          emit({ type: 'packFounded', pack: pack.id, parent: p.id, x: q.x, y: q.y });
        }
      }
    }
    if (p.hungry >= w.starveAfter) {
      p.size--;
      p.hungry = Math.floor(w.starveAfter / 2);
      emit({ type: 'packStarved', pack: p.id, size: p.size });
      if (p.size <= 0) emit({ type: 'packGone', pack: p.id, x: p.x, y: p.y, cause: 'starved' });
    }
  }
  const keep: PackState[] = [];
  for (const p of s.packs) {
    if (p.size <= 0) continue;
    if (!isWood(data, s, p)) emit({ type: 'packGone', pack: p.id, x: p.x, y: p.y, cause: 'driven' });
    else keep.push(p);
  }
  s.packs = keep.concat(born);
}

/** Ohne Rudel wandern bei genug Gehölz mit spawnChance neue in ein Revier (den) ein. */
export function immigrate(data: HerdeData, s: HerdeState, emit: Emit): void {
  const w = data.params.wolves;
  if (s.packs.length > 0) return;
  const woods = s.cells.filter((c) => landOf(data, c).wood).length;
  if (woods < w.spawnMinWood || nextFloat(s) >= w.spawnChance) return;
  const { width } = islandOf(data, s);
  const dens: Pos[] = [];
  s.cells.forEach((c, i) => {
    if (landOf(data, c).den) dens.push({ x: i % width, y: Math.floor(i / width) });
  });
  if (dens.length === 0) return;
  const q = pick(s, dens);
  const pack = { id: s.nextPackId++, x: q.x, y: q.y, size: 1, fed: 0, hungry: 0 };
  s.packs.push(pack);
  emit({ type: 'packImmigrated', pack: pack.id, x: q.x, y: q.y });
}
