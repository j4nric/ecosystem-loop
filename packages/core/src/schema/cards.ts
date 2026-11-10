/** Schemas der Karten: Kategorien, Ziel-Slots, Effekte und Schwellen. */
import { z } from 'zod';
import { Condition, Conditions, Effect, Id, Text } from './common.ts';

/** Name, unter dem eine Weltkarte die gerade bearbeitete Zone bindet (Effekt- und Schwellen-`at`). */
export const WORLD_ZONE = 'self';

export const Slot = z.discriminatedUnion('kind', [
  z.strictObject({ id: Id, kind: z.literal('zone'), when: Conditions, label: Text.optional() }),
  /** Nachbarzone eines früheren Zonen-Slots. */
  z.strictObject({ id: Id, kind: z.literal('neighbor'), of: Id, when: Conditions, label: Text.optional() }),
  /**
   * Art, die in der Zone eines früheren Slots lebt (Bestand ≥ 1). Optional nur Arten, die `eats` fressen
   * (Wert- oder Art-Id, z. B. vegetation = Pflanzenfresser), oder nur die Arten aus `species`.
   */
  z.strictObject({
    id: Id,
    kind: z.literal('species'),
    in: Id,
    eats: Id.optional(),
    species: z.array(Id).optional(),
    label: Text.optional(),
  }),
  /** Wahl zwischen Varianten der Karte; die Effekte der gewählten Option wirken nach den Grundeffekten. */
  z.strictObject({
    id: Id,
    kind: z.literal('choice'),
    options: z.array(z.strictObject({ id: Id, label: Text, effects: z.array(Effect).min(1) })).min(2),
    label: Text.optional(),
  }),
]);
export type Slot = z.infer<typeof Slot>;

/**
 * Schwelle: Folge, die abhängig vom Zustand der Zielzone eintritt.
 * check "before" = Bedingung wird VOR dem Grundeffekt geprüft (Reihenfolge der Karten zählt),
 * "after" = danach. disturbance = die Folge zählt als Störung der Zone.
 * at = Zonen-Slot der Karte; bei Weltkarten "self" (Standard) = jede Zone einzeln.
 */
export const Trigger = z.strictObject({
  id: Id,
  name: Text,
  icon: z.string().min(1),
  at: Id.default(WORLD_ZONE),
  when: z.array(Condition).min(1),
  check: z.enum(['before', 'after']).default('before'),
  disturbance: z.boolean().default(false),
  effects: z.array(Effect).min(1),
});
export type Trigger = z.infer<typeof Trigger>;

/**
 * Reichweite einer Karte (Konzept 6.2, Variante C):
 * - zone: wirkt auf die gewählten Ziele (Slots).
 * - world: wirkt ohne Zielwahl auf alle Zonen. Keine Zonen-/Art-Slots (ein choice-Slot ist erlaubt).
 */
export const REACHES = ['zone', 'world'] as const;
export const Reach = z.enum(REACHES);
export type Reach = z.infer<typeof Reach>;

/**
 * Weltkarten: Effekte und Schwellen werden für jede Zone einzeln ausgewertet, die Zone ist dabei als
 * "self" gebunden (wie bei Jahreszeiten). `effects` wirken in jeder Zone, `byGeography` zusätzlich nur in
 * Zonen dieser Geografie. Ablauf siehe `cards/world.ts`.
 */
export const Card = z.strictObject({
  id: Id,
  name: Text,
  category: Id,
  cost: z.number().int().nonnegative(),
  reach: Reach.default('zone'),
  slots: z.array(Slot).default([]),
  effects: z.array(Effect).default([]),
  /** Nur Weltkarten: Effekte je Geografie-Id (nach `effects`, in derselben Zone). */
  byGeography: z.record(Id, z.array(Effect).min(1)).default({}),
  triggers: z.array(Trigger).default([]),
});
export type Card = z.infer<typeof Card>;

export const CardCategory = z.strictObject({ id: Id, name: Text });
export type CardCategory = z.infer<typeof CardCategory>;

export const CardsFile = z.strictObject({
  categories: z.array(CardCategory).min(1),
  cards: z.array(Card).min(1),
});
