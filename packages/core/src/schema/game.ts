/** Schemas für Konfiguration, Harmonie und Szenarien sowie die geprüften Spieldaten (GameData). */
import { z } from 'zod';
import type { Card, CardCategory } from './cards.ts';
import type { SpeciesDef } from './life.ts';
import type { EventDef, MetaData } from './events.ts';
import { FORM_KINDS, Id, Text, type FormKindSchema } from './common.ts';
import type { Coupling, FormDef, Geography, MapZone, Season, StatDef } from './world.ts';

export const Config = z.strictObject({
  /** Skala aller Zonenwerte. */
  scale: z.strictObject({ min: z.number().int(), max: z.number().int() }),
  turn: z.strictObject({
    handSize: z.number().int().positive(),
    /** Kartenzwang: so viele Karten pro Runde, sofern eine bezahlbare spielbar ist. */
    minPlays: z.number().int().nonnegative(),
    maxPlays: z.number().int().positive().nullable(),
  }),
  deck: z.strictObject({
    minSize: z.number().int().positive(),
    maxSize: z.number().int().positive(),
    /** Höchstens so viele Kopien derselben Karte im Startdeck. */
    maxCopies: z.number().int().positive(),
  }),
  /** Variierende Startwelten: jeder Startwert streut um ±spread (aus dem Seed), wenn vary an ist. */
  startWorld: z.strictObject({ vary: z.boolean(), spread: z.number().int().nonnegative() }),
  /** Reihenfolge der Natur-Phase (Modul-Ids aus src/rules). */
  pipeline: z.array(Id).min(1),
  /** Parameter je Regel-Modul; geprüft vom Schema des Moduls. */
  rules: z.record(Id, z.unknown()).default({}),
  starterDeck: z.array(Id),
  /** Textbausteine für erzeugte Texte (Kartentext), Platzhalter in {geschweiften Klammern}. */
  texts: z.record(z.string(), Text),
});
export type Config = z.infer<typeof Config>;

const KindWeights = z.strictObject(
  Object.fromEntries(FORM_KINDS.map((k) => [k, z.number()])) as Record<z.infer<typeof FormKindSchema>, z.ZodNumber>,
);

export const HarmonyFile = z.strictObject({
  start: z.number(),
  max: z.number().positive(),
  /** Bei diesem Wert oder darunter kollabiert die Welt. */
  collapseAt: z.number(),
  perRound: z.strictObject({
    /** Beitrag je Zone nach Art ihrer Form. */
    formKind: KindWeights,
    /** Beitrag je Zone mit Störung in dieser Runde. */
    disturbance: z.number(),
    /** je lebender Art */
    perSpecies: z.number(),
    /** einmalig je ausgestorbener Art */
    extinction: z.number(),
    /** je Zone mit Hunger oder Überpopulation in dieser Runde */
    hungerPerZone: z.number(),
    /** je Tier einer Menschen-Art */
    perHuman: z.number(),
  }),
});
export type HarmonyData = z.infer<typeof HarmonyFile>;

export const Scenario = z.strictObject({
  id: Id,
  name: Text,
  description: Text.optional(),
  /** Verschiebt den Startwert eines Werts in allen Zonen, die ihn haben. */
  adjust: z.record(Id, z.number().int()).default({}),
  /** Überschreibt Startwerte/-stufe einzelner Zonen. */
  zones: z
    .record(
      Id,
      z.strictObject({ stats: z.record(Id, z.number().int()).default({}), level: z.number().int().optional() }),
    )
    .default({}),
  harmony: z.number().optional(),
  breath: z.number().int().nonnegative().optional(),
  /** Startleben: Zone → Art → Bestand. */
  populations: z.record(Id, z.record(Id, z.number().int())).default({}),
});
export type Scenario = z.infer<typeof Scenario>;

export const ScenariosFile = z.strictObject({ scenarios: z.array(Scenario).min(1) });

export interface FormRef {
  geography: string;
  form: FormDef;
}

/** Alle Spieldaten, geprüft und mit Lookup-Tabellen. */
export interface GameData {
  config: Config;
  /** Geprüfte Parameter je Regel-Modul (Defaults ergänzt). */
  params: Record<string, unknown>;
  stats: Map<string, StatDef>;
  commonStats: string[];
  geographies: Map<string, Geography>;
  forms: Map<string, FormRef>;
  zones: MapZone[];
  seasons: Season[];
  startSeason: number;
  couplings: Coupling[];
  categories: Map<string, CardCategory>;
  cards: Map<string, Card>;
  /** Arten in Daten-Reihenfolge (Stufe aufsteigend; bestimmt auch die Reihenfolge beim Fressen). */
  species: Map<string, SpeciesDef>;
  harmony: HarmonyData;
  scenarios: Map<string, Scenario>;
  /** Ereignispool in Daten-Reihenfolge (Konzept 9). */
  events: Map<string, EventDef>;
  /** Meta-Progression: Grundpool und Meilensteine (Konzept 10). */
  meta: MetaData;
}
