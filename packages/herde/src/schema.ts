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
  /** Konzept 7: Jede Karte erhöht die Wildnis. */
  wild: z.number().positive(),
  weight: z.number().positive(),
});
export type Card = z.infer<typeof Card>;
export const CardsFile = z.strictObject({ cards: z.array(Card).min(1) });

export const Season = z.strictObject({
  id: Id,
  name: Text,
  fire: z.boolean().default(false),
});
export type Season = z.infer<typeof Season>;
export const SeasonsFile = z.strictObject({
  monthsPerSeason: z.number().int().positive(),
  seasons: z.array(Season).min(1),
  months: z.array(Text),
});
export type SeasonsFile = z.infer<typeof SeasonsFile>;

/** Jahreszeiten, in denen ein Bedürfnis gilt: Liste von Jahreszeit-Ids oder `all` (ganzjährig). */
export const SeasonSet = z.union([z.literal('all'), z.array(Id)]);
export type SeasonSet = z.infer<typeof SeasonSet>;

/** Futter einer Landschaft für eine Stufe (überlagert food und grow der Landschaft). */
export const Forage = z.strictObject({ food: Count, grow: z.record(Id, Count) });
export type Forage = z.infer<typeof Forage>;

/** Was die Stufe zur Reife für `next` braucht: so viele Merkmale insgesamt, optional eines aus `oneOf`. */
export const Maturity = z.strictObject({
  traits: Count,
  oneOf: z.array(Id).optional(),
});
export type Maturity = z.infer<typeof Maturity>;

export const Stage = z.strictObject({
  id: Id,
  name: Text,
  eats: z.array(Id),
  water: z.array(Id),
  shelter: z.array(Id),
  /** in welchen Jahreszeiten Wasser bzw. Schutz nötig ist (Durst, Kälte, Herdenwahl) */
  needs: z.strictObject({ water: SeasonSet, shelter: SeasonSet }),
  /** Futter-Maximum und Wachstum je Landschaft für diese Stufe; fehlt eine Landschaft, gelten ihre eigenen Werte */
  forage: z.record(Id, Forage).default({}),
  /** Landschaften, die diese Stufe nicht betritt (zusätzlich zu walk: false) */
  blocked: z.array(Id).default([]),
  /** Felder, die die Herde je Monat höchstens zieht (Weg nur über begehbare Felder) */
  move: z.number().int().positive().default(1),
  /** Umkreis für Fressen, Wasser und Schutz */
  reach: z.number().int().positive().default(1),
  foodPerAnimal: z.number().positive(),
  eatFactor: z.number().min(1),
  fatCap: Rate,
  starveRate: Rate,
  birthRate: Rate,
  thirstAfter: z.number().int().positive(),
  thirstLoss: Rate,
  coldLoss: Rate,
  fireLoss: Rate,
  /** jedes reißende Rudel reißt so viele Tiere weniger */
  wolfGuard: Count.default(0),
  trail: Count,
  choice: z.strictObject({
    food: Rate,
    water: Rate,
    shelter: Rate,
    wolves: Rate,
    recent: Rate,
    stay: Rate,
  }),
  /** Folgestufe (fester Weg); ohne Angabe ist die Stufe die letzte */
  next: Id.optional(),
  /** Reife für `next` (Pflicht, wenn `next` gesetzt ist) */
  mature: Maturity.optional(),
});
export type Stage = z.infer<typeof Stage>;
export const StagesFile = z.strictObject({ stages: z.array(Stage).min(1) });

/** Zahlen einer Stufe, die Merkmale verändern dürfen. Ganzzahlige Werte werden nach der Änderung gerundet. */
export const STAGE_STATS = [
  'foodPerAnimal',
  'eatFactor',
  'fatCap',
  'starveRate',
  'birthRate',
  'thirstAfter',
  'thirstLoss',
  'coldLoss',
  'fireLoss',
  'wolfGuard',
  'trail',
  'move',
  'reach',
] as const;
export type StageStat = (typeof STAGE_STATS)[number];

/** Wirkung eines Merkmals auf einen Stufenwert: Wert × mul + add. */
export const TraitEffect = z
  .strictObject({ stat: z.enum(STAGE_STATS), mul: Rate.optional(), add: z.number().optional() })
  .refine((e) => e.mul !== undefined || e.add !== undefined, 'mul oder add angeben');
export type TraitEffect = z.infer<typeof TraitEffect>;

/**
 * Bedingung einer Erfahrung, je Monat geprüft (nach Fressen, Durst, Kälte und Wölfen, nur wenn die Herde lebt):
 * sheltered – Schutz in der Nähe in einer Jahreszeit, in der die Stufe Schutz braucht (+1)
 * watered   – Wasser in der Nähe in einer Jahreszeit, in der die Stufe Wasser braucht (+1)
 * hunted    – Wölfe haben gerissen, die Herde lebt (+1)
 * fire      – ein Waldbrand hat das Feld der Herde oder ein Nachbarfeld erfasst (+1)
 * ate       – die Herde steht auf einer der Landschaften `lands` und hat gefressen (+1)
 * on        – die Herde steht auf einer der Landschaften `lands` (+1)
 * moved     – gegangene Felder (+ Zahl der Felder)
 */
export const ExperienceWhen = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('sheltered') }),
  z.strictObject({ type: z.literal('watered') }),
  z.strictObject({ type: z.literal('hunted') }),
  z.strictObject({ type: z.literal('fire') }),
  z.strictObject({ type: z.literal('ate'), lands: z.array(Id).min(1) }),
  z.strictObject({ type: z.literal('on'), lands: z.array(Id).min(1) }),
  z.strictObject({ type: z.literal('moved') }),
]);
export type ExperienceWhen = z.infer<typeof ExperienceWhen>;

export const Experience = z.strictObject({ id: Id, name: Text, when: ExperienceWhen });
export type Experience = z.infer<typeof Experience>;

export const Trait = z.strictObject({
  id: Id,
  name: Text,
  text: Text,
  icon: z.string(),
  /** Erfahrung (Id) und Schwelle, ab der das Merkmal angeboten werden kann */
  from: Id,
  at: z.number().int().positive(),
  effects: z.array(TraitEffect).min(1),
});
export type Trait = z.infer<typeof Trait>;

export const TraitsFile = z.strictObject({
  /** so viele verfügbare Merkmale werden zu Beginn einer Jahreszeit höchstens angeboten */
  offerSize: z.number().int().positive(),
  experiences: z.array(Experience).min(1),
  traits: z.array(Trait).min(1),
});

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
    starveReset: z.number().int().nonnegative(),
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
  experiences: Map<string, Experience>;
  traits: Map<string, Trait>;
  /** Merkmale je Angebot höchstens */
  offerSize: number;
  params: Params;
  islands: Map<string, Island>;
}
