/** Schemas der Ereignisse (Konzept 9) und der Meta-Progression (Konzept 10). */
import { z } from 'zod';
import { Conditions, Effect, Id, Text } from './common.ts';
import { SeasonRule } from './world.ts';

/**
 * Zielzone eines Ereignisses: random = beim Ankündigen ausgelost (die Zone wird angezeigt),
 * densest = beim Eintreten die Zone mit der dichtesten Population (gebunden als "target", die Art als "species").
 */
export const EventTarget = z.strictObject({
  pick: z.enum(['random', 'densest']),
  /** Nur Zonen, die diese Bedingungen erfüllen. */
  when: Conditions,
});
export type EventTarget = z.infer<typeof EventTarget>;

export const EventDef = z.strictObject({
  id: Id,
  name: Text,
  /** Kurztext der Wirkung für die Ankündigung. */
  description: Text,
  icon: z.string().min(1),
  /** Relatives Gewicht bei der Auslosung. */
  weight: z.number().positive(),
  /** Frühestes Jahr, in dem das Ereignis eintreten kann. */
  fromYear: z.number().int().positive().default(1),
  target: EventTarget.optional(),
  /** Effekte je Zone (wie Jahreszeiten: "self" = die Zone, zusätzlich "target"). */
  rules: z.array(SeasonRule).default([]),
  /** Effekte auf die Zielzone ("target") oder alle Zonen (scope: all). */
  effects: z.array(Effect).default([]),
  /**
   * Karte, die auf die Zielzone wirkt – mit ihren Schwellen (z. B. Blitzschlag = Gewitter). Zonenkarte: braucht
   * target.pick random. Weltkarte: wirkt mit Zielzone nur dort, ohne Zielzone auf allen Zonen.
   */
  card: Id.optional(),
  /** Stärke-Skalierung über die Jahre (rules.forecast.strength) gilt für adjust- und population-Effekte. */
  scales: z.boolean().default(true),
});
export type EventDef = z.infer<typeof EventDef>;

export const EventsFile = z.strictObject({ events: z.array(EventDef) });

/** Kennzahlen des Schöpfungsbuchs, auf die sich Meilensteine beziehen. */
export const BOOK_STATS = [
  'games',
  'discovered',
  'extinctions',
  'events',
  'rounds',
  'bestScore',
  'bestRounds',
  'bestTier',
] as const;
export type BookStat = (typeof BOOK_STATS)[number];

export const Milestone = z.strictObject({
  id: Id,
  name: Text,
  description: Text,
  /** Alle Bedingungen müssen gelten (Kennzahl ≥ Wert). */
  when: z.array(z.strictObject({ stat: z.enum(BOOK_STATS), gte: z.number() })).min(1),
  /** Karten, die mit dem Meilenstein in den Kartenpool kommen. */
  unlocks: z.array(Id).default([]),
});
export type Milestone = z.infer<typeof Milestone>;

export const MetaFile = z.strictObject({
  /** Karten, die von Anfang an im Pool für Startdecks sind. */
  basePool: z.array(Id).min(1),
  milestones: z.array(Milestone).default([]),
});
export type MetaData = z.infer<typeof MetaFile>;
