/**
 * Zielbereiche der Idealform (Konzept 4.2): Jede Geografie hat genau eine Form mit `kind: ideal`. Aus deren
 * stat-Bedingungen ergibt sich je Wert ein Zielbereich; der Abstand einer Zone zur Idealform ist die Summe der
 * Schritte, die ihre Werte außerhalb dieser Bereiche liegen. Reine Funktionen ohne Zustand.
 */
import type { TargetStatus } from './api.ts';
import type { Condition, FormDef, Geography } from './schema/index.ts';

/** Zielbereich eines Werts (inklusive Grenzen). */
export interface StatRange {
  min: number;
  max: number;
}

/** Idealform einer Geografie mit den Zielbereichen der von ihr eingeschränkten Werte. */
export interface IdealTarget {
  /** Id der Idealform. */
  form: string;
  /** Wert-Id → Zielbereich; nur Werte, die die Idealform einschränkt. */
  ranges: Record<string, StatRange>;
}

/**
 * Zielbereiche aus den Bedingungen einer Form: eq ⇒ min = max; nur gte ⇒ max = Skalenmax; nur lte ⇒ min = Skalenmin.
 * Mehrere Bedingungen auf denselben Wert werden geschnitten. Nicht-stat-Bedingungen (auch verschachtelte in
 * any/not/anyNeighbor) zählen nicht – sie lassen sich nicht als Bereich eines Zonenwerts darstellen.
 */
export function rangesOf(when: readonly Condition[], scale: StatRange): Record<string, StatRange> {
  const out: Record<string, StatRange> = {};
  for (const c of when) {
    if (!('stat' in c)) continue;
    const r = (out[c.stat] ??= { min: scale.min, max: scale.max });
    if (c.gte !== undefined) r.min = Math.max(r.min, c.gte);
    if (c.lte !== undefined) r.max = Math.min(r.max, c.lte);
    if (c.eq !== undefined) {
      r.min = Math.max(r.min, c.eq);
      r.max = Math.min(r.max, c.eq);
    }
  }
  return out;
}

/** Idealform einer Geografie oder null, wenn sie keine hat. Bei mehreren gilt die erste (die Datenprüfung meldet das). */
export function idealFormOf(geography: Geography): FormDef | null {
  return geography.forms.find((f) => f.kind === 'ideal') ?? null;
}

/** Zielbereiche der Idealform einer Geografie (null ohne Idealform). */
export function idealTargetOf(geography: Geography, scale: StatRange): IdealTarget | null {
  const form = idealFormOf(geography);
  return form ? { form: form.id, ranges: rangesOf(form.when, scale) } : null;
}

/** Schritte, die ein Wert außerhalb seines Zielbereichs liegt (0 = im Bereich). */
export function statDistance(range: StatRange, v: number): number {
  return Math.max(0, range.min - v, v - range.max);
}

/** Lage eines Werts zum Zielbereich. */
export function targetStatus(range: StatRange, v: number): TargetStatus {
  return v < range.min ? 'low' : v > range.max ? 'high' : 'ok';
}

/** Abstand einer Zone zur Idealform: Summe über die eingeschränkten Werte (fehlende Werte zählen nicht). */
export function idealDistance(target: IdealTarget, stats: Readonly<Record<string, number>>): number {
  let d = 0;
  for (const [stat, range] of Object.entries(target.ranges)) {
    const v = stats[stat];
    if (v !== undefined) d += statDistance(range, v);
  }
  return d;
}
