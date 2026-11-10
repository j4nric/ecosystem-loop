/** Schemas der Welt: Werte, Geografien mit Formen, Karte der Insel, Jahreszeiten, Kopplungen. */
import { z } from 'zod';
import { Conditions, Effect, FormKindSchema, Id, Text } from './common.ts';

export const StatDef = z.strictObject({
  id: Id,
  name: Text,
  /** Kurzzeichen für knappe Anzeigen (Konsole). */
  short: z.string().min(1).max(3),
});
export type StatDef = z.infer<typeof StatDef>;

export const FormDef = z.strictObject({
  id: Id,
  name: Text,
  kind: FormKindSchema,
  /** Leer = „sonst“. Bei mehreren passenden Formen gilt die erste. */
  when: Conditions,
});
export type FormDef = z.infer<typeof FormDef>;

const StatValues = z.record(Id, z.number().int());

export const Geography = z.strictObject({
  id: Id,
  name: Text,
  /** Sonderwert dieser Geografie (zusätzlich zu den gemeinsamen Werten). */
  special: Id,
  /** Ruhewerte: natürlicher Zustand, zu dem die Selbstheilung zurückführt. */
  rest: StatValues,
  forms: z.array(FormDef).min(1),
});
export type Geography = z.infer<typeof Geography>;

export const GeographiesFile = z.strictObject({
  stats: z.array(StatDef).min(1),
  /** Werte, die jede Zone hat (in Anzeige-Reihenfolge). */
  common: z.array(Id).min(1),
  geographies: z.array(Geography).min(1),
});

export const MapZone = z.strictObject({
  id: Id,
  geography: Id,
  neighbors: z.array(Id),
  /** Startwerte; fehlende Werte = Ruhewert der Geografie. */
  start: StatValues.default({}),
  level: z.number().int().default(1),
  tags: z.array(Id).default([]),
});
export type MapZone = z.infer<typeof MapZone>;

export const MapFile = z.strictObject({ zones: z.array(MapZone).min(1) });

export const SeasonRule = z.strictObject({
  /** Nur Zonen dieser Geografien (leer = alle). */
  geographies: z.array(Id).default([]),
  when: Conditions,
  effects: z.array(Effect).min(1),
});
export type SeasonRule = z.infer<typeof SeasonRule>;

export const Season = z.strictObject({
  id: Id,
  name: Text,
  rules: z.array(SeasonRule).default([]),
  /** Wachstum der Populationen pausiert (Winter; wirkt ab Phase 2). */
  pausesGrowth: z.boolean().default(false),
});
export type Season = z.infer<typeof Season>;

export const SeasonsFile = z.strictObject({
  /** Jahreszeit der ersten Runde. */
  start: Id,
  seasons: z.array(Season).min(1),
});

export const Coupling = z.strictObject({
  id: Id,
  name: Text,
  /** Nur in diesen Jahreszeiten (leer = immer). */
  seasons: z.array(Id).default([]),
  /** Quellzonen: Geografie + Bedingungen an die Quelle. */
  from: z.strictObject({ geography: Id, when: Conditions }),
  /** Ziele sind Nachbarn der Quelle, optional auf eine Geografie beschränkt. */
  to: z.strictObject({ geography: Id.optional(), when: Conditions }).default({ when: [] }),
  /** Effekte wirken auf das Ziel ("self"); die Quelle heißt "source". */
  effects: z.array(Effect).min(1),
});
export type Coupling = z.infer<typeof Coupling>;

export const CouplingsFile = z.strictObject({ couplings: z.array(Coupling) });
