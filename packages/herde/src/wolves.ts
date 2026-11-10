/**
 * Wölfe (Konzept 6): Reißen, Wandern durchs Gehölz, Wachsen, Gründen, Verhungern, Einwandern.
 * Schritt 7 eines Monats.
 */
import { nextFloat, pick } from './rng.ts';
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeState, PackState, Pos, PreyState } from './state.ts';
import { around, cellAt, cheb, islandOf, landOf, samePos, stageOf } from './world.ts';

const isWood = (data: HerdeData, s: HerdeState, p: Pos) => landOf(data, cellAt(data, s, p.x, p.y)).wood;

/**
 * Ein Rudel mit Wild im Umkreis 1 reißt davon (`wolves.preyKill` Tiere, der größte Bestand zuerst) und wird um
 * `wolves.preyFed` satter. Liefert, ob es gefressen hat.
 */
function eatPrey(data: HerdeData, s: HerdeState, p: PackState, emit: Emit): boolean {
  const w = data.params.wolves;
  let target: PreyState | null = null;
  for (const q of s.prey) if (cheb(p, q) <= 1 && (!target || q.size > target.size)) target = q;
  if (!target) return false;
  const killed = Math.min(w.preyKill, target.size);
  target.size -= killed;
  p.fed += w.preyFed;
  p.hungry = 0;
  emit({ type: 'packAtePrey', pack: p.id, prey: target.id, killed, size: target.size });
  if (target.size <= 0) s.prey = s.prey.filter((q) => q !== target);
  return true;
}

/**
 * Rudel fressen zuerst Wild in Reichweite (Umkreis 1). Sonst reißen sie Tiere der Herde in Reichweite, je Rudel so
 * viele wie seine Stärke abzüglich `wolfGuard` der Stufe (Merkmal Wachsamkeit) – nur, wenn die Stufe die Wölfe als
 * Feinde hat (`wolves: enemy`). Liefert die gerissenen Tiere der Herde.
 */
export function hunt(data: HerdeData, s: HerdeState, deadSoFar: number, emit: Emit): number {
  const stage = stageOf(data, s);
  const guard = stage.wolfGuard;
  let killed = 0;
  for (const p of s.packs) {
    // AUSLEGUNG: Wild geht immer vor (Konzept 9.2: hungrige Rudel gehen eher auf Wild als auf die Herde) – auch
    // wenn die Herde ebenfalls in Reichweite ist.
    if (eatPrey(data, s, p, emit)) continue;
    if (stage.wolves === 'rival') {
      p.hungry++;
      continue;
    }
    const alive = s.herd.size - deadSoFar - killed;
    // AUSLEGUNG: Wehrt die Herde ein Rudel ganz ab (Stärke ≤ wolfGuard), ist das kein Angriff: kein Ereignis,
    // das Rudel bleibt hungrig wie ohne Beute.
    if (cheb(p, s.herd) <= 1 && alive > 0 && p.size > guard) {
      const k = Math.min(p.size - guard, alive);
      killed += k;
      p.fed += k;
      p.hungry = 0;
      emit({ type: 'wolvesHunted', pack: p.id, killed: k });
    } else p.hungry++;
  }
  return killed;
}

/**
 * Hungrige Rudel ziehen ein Feld durchs Gehölz auf ihre Beute zu (nur auf freie Gehölz-Felder, die näher liegen):
 * zum nächsten Wild, ohne Wild zur Herde (nur wenn die Stufe die Wölfe als Feinde hat).
 */
export function roam(data: HerdeData, s: HerdeState, emit: Emit): void {
  const island = islandOf(data, s);
  const targets: Pos[] = s.prey.length > 0 ? s.prey : stageOf(data, s).wolves === 'enemy' ? [s.herd] : [];
  if (targets.length === 0) return;
  const distance = (q: Pos) => Math.min(...targets.map((t) => cheb(q, t)));
  for (const p of s.packs) {
    if (p.hungry < data.params.wolves.hungryAfter) continue;
    const dist = distance(p);
    let best: (Pos & { d: number }) | null = null;
    for (const q of around(island, p.x, p.y)) {
      if (!isWood(data, s, q) || s.packs.some((o) => o !== p && samePos(o, q))) continue;
      const d = distance(q);
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
      p.hungry = w.starveReset;
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
