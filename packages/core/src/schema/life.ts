/** Schemas des Lebens: Arten mit Stammbaum, Lebensraum, Nahrung und Gaben (Konzept 5). */
import { z } from 'zod';
import type { SpeciesGroup } from '../api.ts';
import { Conditions, Id, Text } from './common.ts';

export const SPECIES_GROUPS = [
  'water',
  'insect',
  'amphibian',
  'reptile',
  'bird',
  'mammal',
  'human',
] as const satisfies readonly SpeciesGroup[];

export const SpeciesDef = z.strictObject({
  id: Id,
  name: Text,
  /** Gruppe für die Darstellung (Symbol/Farbe in der Oberfläche); keine Regelwirkung. */
  group: z.enum(SPECIES_GROUPS),
  /** Entwicklungsstufe (Konzept 5.3); zählt auch für die Wertung. */
  tier: z.number().int().positive(),
  /** Vorfahr im Stammbaum; null = Startleben, entsteht nicht durch Evolution. */
  ancestor: Id.nullable().default(null),
  /** Formen, in denen die Art leben (wachsen) kann (Konzept 4.2 „Lebensraum für“). */
  habitat: z.array(Id).min(1),
  /** Nahrung in Reihenfolge des Vorzugs: Wert-Ids (Vegetation, Totholz, Licht …) oder Art-Ids (Beute). */
  diet: z.array(Id).min(1),
  /** Karten, die ins Deck kommen, wenn die Art erstmals entsteht. */
  gift: z.array(Id).default([]),
  /** Zusätzliche Bedingungen an die Ursprungszone für die Evolution (z. B. Wolf braucht Hirsche). */
  evolve: Conditions,
  /** Arten, deren Bestand diese Art jede Runde in ihrer Zone senkt (Mensch jagt Pflanzenfresser). */
  hunts: z.array(Id).default([]),
  /** Mensch: kostet Harmonie je Tier und verdoppelt die Wertung (Konzept 5.4). */
  human: z.boolean().default(false),
});
export type SpeciesDef = z.infer<typeof SpeciesDef>;

export const SpeciesFile = z.strictObject({ species: z.array(SpeciesDef).min(1) });
