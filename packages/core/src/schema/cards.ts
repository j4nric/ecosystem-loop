/** Schemas der Karten: Kategorien, Ziel-Slots, Effekte und Schwellen. */
import { z } from 'zod';
import { Condition, Conditions, Effect, Id, Text } from './common.ts';

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
 */
export const Trigger = z.strictObject({
  id: Id,
  name: Text,
  icon: z.string().min(1),
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
  category: Id,
  cost: z.number().int().nonnegative(),
  slots: z.array(Slot).default([]),
  effects: z.array(Effect).default([]),
  triggers: z.array(Trigger).default([]),
});
export type Card = z.infer<typeof Card>;

export const CardCategory = z.strictObject({ id: Id, name: Text });
export type CardCategory = z.infer<typeof CardCategory>;

export const CardsFile = z.strictObject({
  categories: z.array(CardCategory).min(1),
  cards: z.array(Card).min(1),
});
