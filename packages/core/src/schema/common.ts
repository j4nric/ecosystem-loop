/**
 * Gemeinsame Bausteine der Datenschemas: Ids, Texte, Bedingungen und Effekte.
 * Karten, Jahreszeiten, Kopplungen und Formen benutzen dieselbe Bedingungs- und Effektsprache.
 */
import { z } from 'zod';
import type { FormKind } from '../api.ts';

export const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'Ids: Kleinbuchstaben, Ziffern, _');

/** Lokalisierter Text: jede Sprache ist Pflicht. */
export const Text = z.strictObject({ de: z.string().min(1), en: z.string().min(1) });
export type Text = z.infer<typeof Text>;

export const FORM_KINDS = ['ideal', 'normal', 'degraded', 'disturbance'] as const satisfies readonly FormKind[];
export const FormKindSchema = z.enum(FORM_KINDS);

// ---------------------------------------------------------------------------
// Bedingungen (rekursiv). Sie werden immer gegen eine Zone ausgewertet.
// ---------------------------------------------------------------------------

export type Condition =
  /** Wert der Zone; fehlt der Wert in dieser Geografie, ist die Bedingung falsch. */
  | { stat: string; gte?: number; lte?: number; eq?: number }
  /** Die Zone hat diesen Wert (z. B. nur Flachland hat „Boden“). */
  | { hasStat: string }
  | { geography: string }
  | { form: string }
  | { formKind: FormKind }
  /** Globale Bedingung: aktuelle Jahreszeit. */
  | { season: string }
  /** Störung in dieser Zone in den letzten n Runden (inkl. der aktuellen). */
  | { disturbedWithin: number }
  /** Bestand einer Art in dieser Zone (fehlende Art = 0). */
  | { population: string; gte?: number; lte?: number; eq?: number }
  /** Zonenstufe mindestens n. */
  | { minLevel: number }
  | { anyNeighbor: Condition[] }
  | { not: Condition[] }
  | { any: Condition[] };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z
      .strictObject({
        stat: Id,
        gte: z.number().int().optional(),
        lte: z.number().int().optional(),
        eq: z.number().int().optional(),
      })
      .refine((c) => c.gte !== undefined || c.lte !== undefined || c.eq !== undefined, {
        message: 'stat-Bedingung braucht gte, lte oder eq',
      }),
    z.strictObject({ hasStat: Id }),
    z.strictObject({ geography: Id }),
    z.strictObject({ form: Id }),
    z.strictObject({ formKind: FormKindSchema }),
    z.strictObject({ season: Id }),
    z.strictObject({ disturbedWithin: z.number().int().positive() }),
    z
      .strictObject({
        population: Id,
        gte: z.number().int().optional(),
        lte: z.number().int().optional(),
        eq: z.number().int().optional(),
      })
      .refine((c) => c.gte !== undefined || c.lte !== undefined || c.eq !== undefined, {
        message: 'population-Bedingung braucht gte, lte oder eq',
      }),
    z.strictObject({ minLevel: z.number().int().positive() }),
    z.strictObject({ anyNeighbor: z.array(Condition).min(1) }),
    z.strictObject({ not: z.array(Condition).min(1) }),
    z.strictObject({ any: z.array(Condition).min(1) }),
  ]),
);
export const Conditions = z.array(Condition).default([]);

// ---------------------------------------------------------------------------
// Effekte. "at" benennt eine gebundene Zone (Karten-Slot, bei Jahreszeiten/Kopplungen "self",
// bei Kopplungen zusätzlich "source"), "scope" erweitert auf Nachbarn oder alle Zonen.
// ---------------------------------------------------------------------------

export const SCOPES = ['self', 'neighbors', 'area', 'all'] as const;
export const Scope = z.enum(SCOPES).default('self');
export type Scope = z.infer<typeof Scope>;

const At = Id.default('self');

export const Effect = z.union([
  /** Wert um `by` ändern. */
  z.strictObject({ adjust: Id, by: z.number().int(), at: At, scope: Scope }),
  /** Wert fest setzen. */
  z.strictObject({ set: Id, value: z.number().int(), at: At, scope: Scope }),
  /** Werte zum Ruhewert der Geografie: ganz (ohne steps) oder um `steps` Schritte. */
  z.strictObject({
    restore: z.union([z.literal('all'), Id]),
    steps: z.number().int().positive().optional(),
    at: At,
    scope: Scope,
  }),
  /** Bis zu `amount` Punkte von `stat` der Zone `from` wandern als `into` in die Zone(n) `at`. */
  z.strictObject({ transfer: Id, into: Id, amount: z.number().int().positive(), from: Id, at: At }),
  /** Karten ziehen. */
  z.strictObject({ draw: z.number().int().positive() }),
  /** Odem gewinnen (oder verlieren). */
  z.strictObject({ breath: z.number().int() }),
  /** Bestand einer Art (Art-Id oder Id eines Art-Slots der Karte) um `by` ändern. */
  z.strictObject({ population: Id, by: z.number().int(), at: At, scope: Scope }),
  /** Bis zu `amount` Tiere einer Art (Art-Id oder Art-Slot) wandern von Zone `from` in Zone `at`. */
  z.strictObject({ move: Id, amount: z.number().int().positive(), from: Id, at: At }),
]);
export type Effect = z.infer<typeof Effect>;
