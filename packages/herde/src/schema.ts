/**
 * zod-Schemas der Spieldaten (YAML in packages/herde/data) und die daraus gebauten Datentypen.
 * Querverweise (Ids zwischen den Dateien) prüft erst src/data.ts.
 */
import { z } from 'zod';

export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'Ids: Kleinbuchstaben, Ziffern, _');

/** Lokalisierter Text: jede Sprache ist Pflicht. */
export const Text = z.strictObject({ de: z.string().min(1), en: z.string().min(1) });
export type Text = z.infer<typeof Text>;

const Count = z.number().int().nonnegative();
const Chance = z.number().min(0).max(1);
const Rate = z.number().nonnegative();

export const Succession = z.strictObject({
  to: Id,
  months: z.number().int().positive(),
  /** age: Monate seit Entstehung des Felds · ungrazed: Monate seit der letzten Beweidung */
  clock: z.enum(['age', 'ungrazed']),
  /** Futter nach dem Wandel (ohne Angabe: gekappt auf das neue Maximum) */
  food: Count.optional(),
  /** so viele Monate ist das neue Feld fruchtbar */
  fertile: Count.optional(),
});
export type Succession = z.infer<typeof Succession>;

export const CellStart = z.strictObject({
  food: Count.default(0),
  foodRandom: Count.default(0),
  ageRandom: Count.default(0),
  ungrazedRandom: Count.default(0),
});
export type CellStart = z.infer<typeof CellStart>;

export const Landscape = z.strictObject({
  id: Id,
  name: Text,
  icon: z.string(),
  walk: z.boolean(),
  food: Count,
  fertileBonus: Count.default(0),
  grow: z.record(Id, Count),
  wood: z.boolean().default(false),
  den: z.boolean().default(false),
  burnsTo: Id.optional(),
  fireChance: Chance.default(0),
  succession: Succession.optional(),
  start: CellStart.optional(),
});
export type Landscape = z.infer<typeof Landscape>;
export const LandscapesFile = z.strictObject({ landscapes: z.array(Landscape).min(1) });

export const CardEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('transform'), to: Id, food: Count.optional() }),
  z.strictObject({ type: z.literal('ignite') }),
  z.strictObject({ type: z.literal('grow'), amount: z.number().int().positive() }),
]);
export type CardEffect = z.infer<typeof CardEffect>;

export const Card = z.strictObject({
  id: Id,
  name: Text,
  text: Text,
  icon: z.string(),
  on: z.array(Id).min(1),
  global: z.boolean().default(false),
  effect: CardEffect,
  wild: Rate,
  weight: z.number().positive(),
});
export type Card = z.infer<typeof Card>;
export const CardsFile = z.strictObject({ cards: z.array(Card).min(1) });

export const Season = z.strictObject({
  id: Id,
  name: Text,
  water: z.boolean().default(false),
  shelter: z.boolean().default(false),
  fire: z.boolean().default(false),
});
export type Season = z.infer<typeof Season>;
export const SeasonsFile = z.strictObject({
  monthsPerSeason: z.number().int().positive(),
  seasons: z.array(Season).min(1),
  months: z.array(Text),
});
export type SeasonsFile = z.infer<typeof SeasonsFile>;

export const Stage = z.strictObject({
  id: Id,
  name: Text,
  eats: z.array(Id),
  water: z.array(Id),
  shelter: z.array(Id),
  foodPerAnimal: z.number().positive(),
  eatFactor: z.number().min(1),
  fatCap: Rate,
  starveRate: Rate,
  birthRate: Rate,
  thirstAfter: z.number().int().positive(),
  thirstLoss: Rate,
  coldLoss: Rate,
  fireLoss: Rate,
  trail: Count,
  choice: z.strictObject({
    food: Rate,
    water: Rate,
    shelter: Rate,
    wolves: Rate,
    recent: Rate,
    stay: Rate,
  }),
});
export type Stage = z.infer<typeof Stage>;
export const StagesFile = z.strictObject({ stages: z.array(Stage).min(1) });

export const Params = z.strictObject({
  herd: z.strictObject({
    stage: Id,
    size: z.number().int().positive(),
    fat: Count,
    birthMonth: Count,
  }),
  fire: z.strictObject({ spread: Chance }),
  wolves: z.strictObject({
    hungryAfter: z.number().int().positive(),
    fedToGrow: z.number().int().positive(),
    maxSize: z.number().int().positive(),
    foundRadius: z.number().int().positive(),
    starveAfter: z.number().int().positive(),
    spawnChance: Chance,
    spawnMinWood: Count,
  }),
  wild: z.strictObject({ start: Rate, perMonth: Rate, max: z.number().positive() }),
  ice: z.strictObject({ months: z.number().int().positive(), season: Id }),
  cards: z.strictObject({
    startHand: Count,
    drawPerSeason: Count,
    handMax: Count,
  }),
});
export type Params = z.infer<typeof Params>;

const Pos = z.strictObject({ x: Count, y: Count });
export const Island = z.strictObject({
  id: Id,
  name: Text,
  legend: z.record(z.string().length(1), Id),
  rows: z.array(z.string().min(1)).min(1),
  herd: Pos,
  packs: z.array(z.strictObject({ x: Count, y: Count, size: z.number().int().positive() })),
});
export type IslandRaw = z.infer<typeof Island>;
export const IslandsFile = z.strictObject({ islands: z.array(Island).min(1) });

/** Eine Insel nach dem Aufbau: Raster als Landschafts-Ids (Zeile für Zeile). */
export interface Island {
  id: string;
  name: Text;
  width: number;
  height: number;
  /** Landschaft je Feld, Index = y * width + x */
  cells: string[];
  herd: { x: number; y: number };
  packs: { x: number; y: number; size: number }[];
}

/** Geprüfte Spieldaten (Maps in Datei-Reihenfolge). */
export interface HerdeData {
  landscapes: Map<string, Landscape>;
  cards: Map<string, Card>;
  seasons: Season[];
  monthsPerSeason: number;
  /** Monatsnamen eines Jahres (Länge = Jahreszeiten × monthsPerSeason) */
  months: Text[];
  stages: Map<string, Stage>;
  params: Params;
  islands: Map<string, Island>;
}
