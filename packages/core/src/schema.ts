/**
 * Schema der Spieldaten. Alle Regeln (Karten, Tiere, Zonen, Parameter) sind Daten
 * und werden beim Laden gegen dieses Schema geprüft.
 */
import { z } from 'zod';

export const STATS = ['light', 'moisture', 'density', 'deadwood'] as const;
export const Stat = z.enum(STATS);
export type Stat = z.infer<typeof Stat>;

/** Lokalisierter Text, z. B. { de: "Käfer" }. */
export const Text = z.object({ de: z.string() }).catchall(z.string());
export type Text = z.infer<typeof Text>;

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids: kleinbuchstaben, ziffern, _');

// ---------------------------------------------------------------------------
// Bedingungen (rekursiv)
// ---------------------------------------------------------------------------

export type Condition =
  | { stat: Stat; gte?: number; lte?: number; eq?: number }
  | { animal: string }
  | { noAnimal: string }
  | { tag: string }
  | { noTag: string }
  | { zoneType: string }
  | { anyNeighbor: Condition[] }
  | { cardPlayed: string; gte: number }
  | { calmTurns: number }
  | { hasAnimals: boolean }
  | { not: Condition[] }
  | { any: Condition[] };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z
      .strictObject({
        stat: Stat,
        gte: z.number().optional(),
        lte: z.number().optional(),
        eq: z.number().optional(),
      })
      .refine((c) => c.gte !== undefined || c.lte !== undefined || c.eq !== undefined, {
        message: 'stat-Bedingung braucht gte, lte oder eq',
      }),
    z.strictObject({ animal: Id }),
    z.strictObject({ noAnimal: Id }),
    z.strictObject({ tag: Id }),
    z.strictObject({ noTag: Id }),
    z.strictObject({ zoneType: Id }),
    z.strictObject({ anyNeighbor: z.array(Condition) }),
    z.strictObject({ cardPlayed: Id, gte: z.number().int() }),
    z.strictObject({ calmTurns: z.number().int().nonnegative() }),
    z.strictObject({ hasAnimals: z.boolean() }),
    z.strictObject({ not: z.array(Condition) }),
    z.strictObject({ any: z.array(Condition) }),
  ]),
);
const Conditions = z.array(Condition).default([]);

// ---------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------

export const Slot = z.discriminatedUnion('kind', [
  z.strictObject({ id: Id, kind: z.literal('zone'), when: Conditions }),
  z.strictObject({ id: Id, kind: z.literal('neighbor'), of: Id, when: Conditions }),
  z.strictObject({ id: Id, kind: z.literal('otherZone'), of: Id, when: Conditions }),
  z.strictObject({ id: Id, kind: z.literal('animal'), in: Id }),
  z.strictObject({ id: Id, kind: z.literal('handCard') }),
]);
export type Slot = z.infer<typeof Slot>;

const Scope = z.enum(['self', 'neighbors']).default('self');

export const Effect = z.union([
  z.strictObject({ adjust: Stat, by: z.number().int(), at: Id, scope: Scope }),
  z.strictObject({ set: Stat, value: z.number().int(), at: Id, scope: Scope }),
  z.strictObject({ addTag: Id, at: Id, scope: Scope }),
  z.strictObject({ removeTag: Id, at: Id, scope: Scope }),
  z.strictObject({ draw: z.number().int().positive() }),
  z.strictObject({ discard: Id }),
  z.strictObject({ moveAnimal: Id, from: Id, to: Id }),
  z.strictObject({ connect: z.tuple([Id, Id]) }),
  z.strictObject({ include: Id }),
]);
export type Effect = z.infer<typeof Effect>;

export const Trigger = z.strictObject({
  id: Id,
  name: Text,
  icon: z.string().optional(),
  at: Id,
  when: z.array(Condition).min(1),
  check: z.enum(['before', 'after']).default('before'),
  disturbance: z.boolean().default(false),
  effects: z.array(Effect).min(1),
});
export type Trigger = z.infer<typeof Trigger>;

export const Card = z.strictObject({
  id: Id,
  name: Text,
  source: z.enum(['base', 'animal']),
  slots: z.array(Slot).default([]),
  effects: z.array(Effect).default([]),
  triggers: z.array(Trigger).default([]),
});
export type Card = z.infer<typeof Card>;

// ---------------------------------------------------------------------------
// Tiere, Zonen, Szenarien, Parameter
// ---------------------------------------------------------------------------

export const Animal = z.strictObject({
  id: Id,
  name: Text,
  tier: z.number().int().min(1),
  groups: z.array(Id).default([]),
  conditions: z.array(Condition).min(1),
  card: Id,
  eats: z.array(Id).default([]),
});
export type Animal = z.infer<typeof Animal>;

export const Values = z.strictObject({
  light: z.number().int(),
  moisture: z.number().int(),
  density: z.number().int(),
  deadwood: z.number().int(),
});
export type Values = z.infer<typeof Values>;

export const ZoneType = z.strictObject({
  id: Id,
  name: Text,
  transitions: z.array(z.strictObject({ to: Id, when: z.array(Condition).min(1) })).default([]),
});
export type ZoneType = z.infer<typeof ZoneType>;

export const MapZone = z.strictObject({
  id: Id,
  type: Id,
  values: Values,
  neighbors: z.array(Id),
  tags: z.array(Id).default([]),
});
export type MapZone = z.infer<typeof MapZone>;

export const ZonesFile = z.strictObject({
  zoneTypes: z.array(ZoneType).min(1),
  map: z.strictObject({ zones: z.array(MapZone).min(2) }),
});

export const Scenario = z.strictObject({
  id: Id,
  name: Text,
  adjust: Values.partial().default({}),
  zones: z
    .record(z.string(), z.strictObject({ type: Id.optional(), values: Values.partial().optional() }))
    .default({}),
});
export type Scenario = z.infer<typeof Scenario>;

export const Config = z.strictObject({
  values: z.strictObject({ min: z.number().int(), max: z.number().int() }),
  hand: z.strictObject({
    size: z.number().int().positive(),
    minPlaysPerTurn: z.number().int().nonnegative(),
    maxPlaysPerTurn: z.number().int().positive().nullable(),
  }),
  deck: z.strictObject({
    minSize: z.number().int().positive(),
    maxSize: z.number().int().positive(),
    maxCopiesPerCard: z.number().int().positive(),
  }),
  end: z.strictObject({
    onEmptyDrawPile: z.boolean(),
    maxTurns: z.number().int().positive().nullable(),
  }),
  arrival: z.strictObject({
    delayTurns: z.number().int().nonnegative(),
    perZonePerTurn: z.number().int().positive(),
    cardOnArrival: z.enum(['every', 'firstPerSpecies']),
  }),
  predation: z.strictObject({ extinctionTurns: z.number().int().positive() }),
  notebook: z.strictObject({ recordOn: z.enum(['end', 'arrival']) }),
  starterDeck: z.array(Id),
});
export type Config = z.infer<typeof Config>;

/** Alle Spieldaten, geprüft und mit Lookup-Tabellen. */
export interface GameData {
  config: Config;
  cards: Map<string, Card>;
  animals: Map<string, Animal>;
  zoneTypes: Map<string, ZoneType>;
  mapZones: MapZone[];
  scenarios: Map<string, Scenario>;
}
