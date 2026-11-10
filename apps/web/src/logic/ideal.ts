import type { CardView, StatView, TargetStatus } from '@core/api';
import type { PreviewView } from '../client/GameClient.ts';

/**
 * Reine Bausteine rund um die Idealform (ohne React, ohne DOM): Zielbereiche an den Wertbalken, Einfärbung
 * der Zonen während der Zielwahl, und Richtung von Wertänderungen. Die Zahlen (Zielbereiche, Abstände)
 * kommen aus der Engine; hier wird nur klassifiziert. Fehlen die Felder (ältere Engine), bleibt alles neutral.
 */

/** Richtung einer Änderung bezogen auf den Zielbereich der Idealform. */
export type Toward = 'better' | 'worse' | 'neutral';

export type StatTarget = NonNullable<StatView['target']>;

/** Schritte, die `value` außerhalb des Zielbereichs liegt (0 = im Bereich). */
export function targetDistance(value: number, target: { min: number; max: number }): number {
  if (value < target.min) return target.min - value;
  if (value > target.max) return value - target.max;
  return 0;
}

/** Lage eines Werts zum Zielbereich. */
export function targetStatus(value: number, target: { min: number; max: number }): TargetStatus {
  return value < target.min ? 'low' : value > target.max ? 'high' : 'ok';
}

/** Richtung einer Wertänderung `from → to` zum Zielbereich; ohne Zielbereich neutral. */
export function towardOf(from: number, to: number, target: { min: number; max: number } | undefined): Toward {
  if (!target) return 'neutral';
  const before = targetDistance(from, target);
  const after = targetDistance(to, target);
  return after < before ? 'better' : after > before ? 'worse' : 'neutral';
}

/** Richtung aus einem Abstand vorher/nachher. */
export function towardFromDistance(before: number, after: number): Toward {
  return after < before ? 'better' : after > before ? 'worse' : 'neutral';
}

/**
 * Gesamtwirkung eines (vollständigen) Kartenzugs auf die Idealformen: Summe der Abstandsänderungen aller
 * betroffenen Zonen (`idealDistance`). Fehlt `idealDistance`, entscheidet die Mehrheit der `toward`-Angaben
 * der Wertänderungen. Keine Vorschau ⇒ null (keine Einfärbung).
 */
export function classifyPreview(preview: PreviewView | null): Toward | null {
  if (!preview) return null;
  if (preview.idealDistance && preview.idealDistance.length > 0) {
    const sum = preview.idealDistance.reduce((s, d) => s + (d.after - d.before), 0);
    return sum < 0 ? 'better' : sum > 0 ? 'worse' : 'neutral';
  }
  let score = 0;
  for (const c of preview.changes) score += c.toward === 'better' ? 1 : c.toward === 'worse' ? -1 : 0;
  return score > 0 ? 'better' : score < 0 ? 'worse' : 'neutral';
}

/**
 * Einfärbung jeder Kandidatenzone während der Zielwahl: für jede Zone die Vorschau des Zugs mit dieser Zone
 * im Slot `slotId` (übrige Ziele aus `base`). Nur Zonen mit Vorschau bekommen eine Farbe.
 */
export function zoneTints(
  candidates: Iterable<string>,
  previewFor: (zoneId: string) => PreviewView | null,
): Map<string, Toward> {
  const tints = new Map<string, Toward>();
  for (const zone of candidates) {
    const tint = classifyPreview(previewFor(zone));
    if (tint) tints.set(zone, tint);
  }
  return tints;
}

/** Ist die Zielwahl ab diesem Slot vollständig (letzter Slot)? Dann lässt sich jede Kandidatenzone vorab bewerten. */
export function completesCard(card: CardView, slotId: string): boolean {
  return card.slots.at(-1)?.id === slotId;
}

/**
 * Zellen eines Wertbalkens (Werte 1…max): Zelle i steht für den Wert i+1. `on` = Wert erreicht,
 * `target` = Wert liegt im Zielbereich.
 */
export function barCells(value: number, max: number, target?: { min: number; max: number }) {
  return Array.from({ length: max }, (_, i) => ({
    on: i < value,
    target: target !== undefined && i + 1 >= target.min && i + 1 <= target.max,
  }));
}

/** Kurzform eines Zielbereichs: „3“, „2–3“, „≥ 4“, „≤ 1“. */
export function rangeLabel(target: { min: number; max: number }, statMax: number): string {
  if (target.min === target.max) return String(target.min);
  if (target.max >= statMax && target.min > 0) return `≥ ${target.min}`;
  if (target.min <= 0) return `≤ ${target.max}`;
  return `${target.min}–${target.max}`;
}
