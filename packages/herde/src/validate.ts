/**
 * Prüfung gespeicherter Spielstände: Passt ein Zustand (z. B. aus dem Gerätespeicher) zu den aktuellen Daten?
 * Erst Version und Form (reines JSON nach `HerdeState`), dann bekannte Ids, Raster und Wertebereiche.
 */
import { z } from 'zod';
import type { StateCheck } from './api.ts';
import type { HerdeData } from './schema.ts';
import { STATE_VERSION, type HerdeState } from './state.ts';
import { stageOf } from './world.ts';

const Int = z.number().int();
const Count = Int.nonnegative();
const Num = z.number().finite();
const Pos = z.strictObject({ x: Count, y: Count });

const StateSchema = z.strictObject({
  version: z.literal(STATE_VERSION),
  seed: Count,
  rng: Count.max(0xffffffff),
  island: z.string(),
  month: Count,
  ice: Count,
  wild: Num.nonnegative(),
  over: z.enum(['won', 'lost']).nullable(),
  cells: z.array(z.strictObject({ land: z.string(), food: Count, age: Count, fertile: Count, grazed: Int })),
  herd: z.strictObject({
    stage: z.string(),
    x: Count,
    y: Count,
    size: Count,
    fat: Num.nonnegative(),
    thirst: Count,
    trail: z.array(Pos),
    traits: z.array(z.string()),
    experience: z.record(z.string(), Count),
    offer: z.array(z.string()),
  }),
  packs: z.array(z.strictObject({ id: Count, x: Count, y: Count, size: Int.positive(), fed: Count, hungry: Count })),
  nextPackId: Count,
  hand: z.array(z.string()),
});

function problem(data: HerdeData, s: HerdeState): string | null {
  const island = data.islands.get(s.island);
  if (!island) return `unbekannte Insel ${s.island}`;
  if (s.cells.length !== island.width * island.height)
    return `${s.cells.length} Felder statt ${island.width * island.height}`;
  const unknown = s.cells.find((c) => !data.landscapes.has(c.land));
  if (unknown) return `unbekannte Landschaft ${unknown.land}`;
  const inside = (p: { x: number; y: number }) => p.x < island.width && p.y < island.height;
  const landAt = (p: { x: number; y: number }) => data.landscapes.get(s.cells[p.y * island.width + p.x]!.land)!;

  if (!data.stages.has(s.herd.stage)) return `unbekannte Stufe ${s.herd.stage}`;
  for (const id of s.herd.traits) if (!data.traits.has(id)) return `unbekanntes Merkmal ${id}`;
  if (new Set(s.herd.traits).size !== s.herd.traits.length) return 'Merkmal doppelt';
  for (const id of Object.keys(s.herd.experience)) if (!data.experiences.has(id)) return `unbekannte Erfahrung ${id}`;
  for (const id of data.experiences.keys()) if (!(id in s.herd.experience)) return `Erfahrung ${id} fehlt`;
  if (s.herd.offer.length > data.offerSize)
    return `${s.herd.offer.length} Merkmale im Angebot (max. ${data.offerSize})`;
  for (const id of s.herd.offer) {
    const trait = data.traits.get(id);
    if (!trait) return `unbekanntes Merkmal ${id} im Angebot`;
    if (s.herd.traits.includes(id)) return `Merkmal ${id} angeboten, aber schon gewählt`;
    if (s.herd.experience[trait.from]! < trait.at) return `Merkmal ${id} angeboten, Schwelle nicht erreicht`;
  }

  // Deckel und Spurlänge mit der Wirkung der Merkmale
  const stage = stageOf(data, s);
  if (!inside(s.herd)) return `Herde (${s.herd.x},${s.herd.y}) außerhalb der Insel`;
  if (!landAt(s.herd).walk) return `Herde (${s.herd.x},${s.herd.y}) auf unbegehbarem Feld`;
  if (s.herd.fat > s.herd.size * stage.fatCap) return `Vorrat ${s.herd.fat} über dem Deckel`;
  if (s.herd.trail.length > stage.trail) return `Spur länger als ${stage.trail}`;
  if (s.herd.trail.some((p) => !inside(p))) return 'Spur außerhalb der Insel';
  const ids = new Set<number>();
  const spots = new Set<string>();
  for (const p of s.packs) {
    if (!inside(p)) return `Rudel ${p.id} außerhalb der Insel`;
    if (!landAt(p).wood) return `Rudel ${p.id} nicht im Gehölz`;
    if (spots.has(`${p.x},${p.y}`)) return `zwei Rudel auf Feld (${p.x},${p.y})`;
    spots.add(`${p.x},${p.y}`);
    if (p.size > data.params.wolves.maxSize) return `Rudel ${p.id} stärker als ${data.params.wolves.maxSize}`;
    if (ids.has(p.id)) return `Rudel-Id ${p.id} doppelt`;
    if (p.id >= s.nextPackId) return `Rudel-Id ${p.id} ≥ nextPackId ${s.nextPackId}`;
    ids.add(p.id);
  }
  const card = s.hand.find((id) => !data.cards.has(id));
  if (card) return `unbekannte Karte ${card}`;
  if (s.hand.length > data.params.cards.handMax)
    return `${s.hand.length} Karten auf der Hand (max. ${data.params.cards.handMax})`;
  if (s.ice > data.params.ice.months) return `Eiszeit ${s.ice} länger als ${data.params.ice.months} Monate`;
  return null;
}

/**
 * Prüft, ob ein gespeicherter Zustand zu den aktuellen Daten passt. Wirft nie; `reason` ist eine technische
 * Meldung (Deutsch) für Log und Fehlerbericht.
 */
export function validateState(data: HerdeData, state: unknown): StateCheck {
  try {
    if (typeof state !== 'object' || state === null || Array.isArray(state))
      return { ok: false, reason: 'kein Spielstand (kein Objekt)' };
    const version = (state as { version?: unknown }).version;
    if (version !== STATE_VERSION) return { ok: false, reason: `Version ${String(version)} statt ${STATE_VERSION}` };
    const parsed = StateSchema.safeParse(state);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      return { ok: false, reason: `Format: ${issue.path.join('.') || '(Wurzel)'}: ${issue.message}` };
    }
    const reason = problem(data, parsed.data);
    return reason === null ? { ok: true } : { ok: false, reason };
  } catch (e) {
    return { ok: false, reason: `Prüfung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` };
  }
}
