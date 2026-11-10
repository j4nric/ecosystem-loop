/**
 * Prüfung gespeicherter Spielstände: Passt ein Zustand (z. B. aus dem Gerätespeicher) zu den aktuellen Daten?
 * Erst die Form (reines JSON nach `GameState`), dann Version, bekannte Ids und Wertebereiche.
 */
import { z } from 'zod';
import type { StateCheck } from './api.ts';
import { lifeParams } from './population.ts';
import { LevelsParams } from './rules/levels.ts';
import { paramsOf } from './rules/module.ts';
import type { GameData } from './schema/index.ts';
import { STATE_VERSION, type GameState } from './state.ts';
import { statsOf } from './world.ts';

const Int = z.number().int();
const Count = Int.nonnegative();
const Round = Int.nullable();
const Card = z.strictObject({ uid: Count, card: z.string() });

const Zone = z.strictObject({
  id: z.string(),
  geography: z.string(),
  stats: z.record(z.string(), Int),
  neighbors: z.array(z.string()),
  tags: z.array(z.string()),
  form: z.string(),
  formSince: Count,
  level: Int,
  levelProgress: Count,
  lastDisturbance: Round,
  populations: z.record(z.string(), Int),
  lastHunger: Round,
  evolution: z.record(z.string(), Count),
});

const StateSchema = z.strictObject({
  version: z.literal(STATE_VERSION),
  rng: Int,
  scenario: z.string(),
  round: Int.positive(),
  phase: z.enum(['play', 'over']),
  harmony: z.number().finite(),
  harmonyTrend: z.number().finite(),
  breath: Count,
  zones: z.array(Zone),
  hand: z.array(Card),
  drawPile: z.array(Card),
  discardPile: z.array(Card),
  nextUid: Count,
  playsThisTurn: Count,
  cardPlays: z.record(z.string(), Count),
  species: z.record(z.string(), z.strictObject({ since: Count, extinct: Round })),
  score: z.number().finite(),
  extinctions: z.array(z.strictObject({ species: z.string(), round: Count })),
  forecast: z
    .strictObject({ event: z.string(), round: Count, strength: z.number().finite(), zone: z.string().nullable() })
    .nullable(),
  eventShield: Count,
  eventsOccurred: Count,
});

/** Erster Fehler eines Zustands gegenüber den Daten oder null. */
function problem(data: GameData, s: GameState): string | null {
  if (!data.scenarios.has(s.scenario)) return `unbekanntes Szenario ${s.scenario}`;
  if (s.harmony < 0 || s.harmony > data.harmony.max) return `Harmonie ${s.harmony} außerhalb 0–${data.harmony.max}`;

  const zoneIds = data.zones.map((z) => z.id);
  if (s.zones.map((z) => z.id).join() !== zoneIds.join())
    return `Zonen ${s.zones.map((z) => z.id).join(', ')} statt ${zoneIds.join(', ')}`;
  const { min, max } = data.config.scale;
  const lv = paramsOf(data, { id: 'levels', params: LevelsParams });
  const popMax = lifeParams(data).max;
  for (const [i, z] of s.zones.entries()) {
    const where = `Zone ${z.id}`;
    const geo = data.geographies.get(z.geography);
    if (!geo || data.zones[i]!.geography !== z.geography) return `${where}: unbekannte Geografie ${z.geography}`;
    const expected = statsOf(data, geo);
    const keys = Object.keys(z.stats);
    const missing = expected.find((k) => !(k in z.stats));
    if (missing) return `${where}: Wert ${missing} fehlt`;
    const extra = keys.find((k) => !expected.includes(k));
    if (extra) return `${where}: unbekannter Wert ${extra}`;
    for (const k of keys)
      if (z.stats[k]! < min || z.stats[k]! > max) return `${where}: ${k} = ${z.stats[k]} außerhalb ${min}–${max}`;
    const form = data.forms.get(z.form);
    if (!form || form.geography !== z.geography) return `${where}: unbekannte Form ${z.form}`;
    const stranger = z.neighbors.find((n) => !zoneIds.includes(n));
    if (stranger) return `${where}: unbekannte Nachbarzone ${stranger}`;
    if (z.level < lv.min || z.level > lv.max) return `${where}: Stufe ${z.level} außerhalb ${lv.min}–${lv.max}`;
    for (const [sp, n] of Object.entries(z.populations)) {
      if (!data.species.has(sp)) return `${where}: unbekannte Art ${sp}`;
      if (n < 1 || n > popMax) return `${where}: Bestand ${sp} = ${n} außerhalb 1–${popMax}`;
    }
    const evo = Object.keys(z.evolution).find((sp) => !data.species.has(sp));
    if (evo) return `${where}: unbekannte Art ${evo}`;
  }

  const cards = [...s.hand, ...s.drawPile, ...s.discardPile];
  const unknownCard =
    cards.find((c) => !data.cards.has(c.card))?.card ?? Object.keys(s.cardPlays).find((c) => !data.cards.has(c));
  if (unknownCard) return `unbekannte Karte ${unknownCard}`;
  const uids = new Set(cards.map((c) => c.uid));
  if (uids.size !== cards.length) return 'Karten-uid doppelt';
  if (cards.some((c) => c.uid >= s.nextUid)) return `Karten-uid ≥ nextUid ${s.nextUid}`;

  const unknownSpecies = [...Object.keys(s.species), ...s.extinctions.map((e) => e.species)].find(
    (sp) => !data.species.has(sp),
  );
  if (unknownSpecies) return `unbekannte Art ${unknownSpecies}`;

  if (s.forecast) {
    if (!data.events.has(s.forecast.event)) return `unbekanntes Ereignis ${s.forecast.event}`;
    if (s.forecast.zone !== null && !zoneIds.includes(s.forecast.zone))
      return `Ereignis-Zone ${s.forecast.zone} unbekannt`;
  }
  return null;
}

/**
 * Prüft, ob ein gespeicherter Zustand zu den aktuellen Daten passt: Format und Version, alle Zonen, Geografien,
 * Werte, Formen, Arten, Karten- und Ereignis-Ids bekannt, Werte, Stufen und Bestände im erlaubten Bereich.
 * Wirft nie; `reason` ist eine technische Meldung (Deutsch) für Log und Fehlerbericht.
 */
export function validateState(data: GameData, state: unknown): StateCheck {
  try {
    return checkState(data, state);
  } catch (e) {
    // Exotische Eingaben (Proxys, werfende Getter) – nie durchschlagen lassen.
    return { ok: false, reason: `Prüfung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function checkState(data: GameData, state: unknown): StateCheck {
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
}
