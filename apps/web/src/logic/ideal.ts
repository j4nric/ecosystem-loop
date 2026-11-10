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

// --- Weltkarten (CardView.reach === 'world'): Wirkung auf alle Zonen zugleich ----------------------

/** Wirkt die Karte ohne Zielwahl auf alle Zonen (Wetter)? Fehlt `reach`, ist es eine gezielte Karte. */
export function isWorldCard(card: Pick<CardView, 'reach'>): boolean {
  return card.reach === 'world';
}

/** Wirkung einer (Welt-)Karte auf eine Zone: Abstand zur Idealform vorher/nachher und Einzelwirkungen. */
export interface ZoneEffect {
  zone: string;
  zoneName: string;
  toward: Toward;
  /** Abstand zur Idealform vorher → nachher; null, wenn die Engine keinen liefert. */
  distance: { before: number; after: number } | null;
  changes: PreviewView['changes'];
  triggers: PreviewView['triggers'];
  formChanges: PreviewView['formChanges'];
  populationChanges: PreviewView['populationChanges'];
}

/**
 * Zerlegt eine Vorschau nach Zonen. Betroffen ist eine Zone mit Wertänderung, Schwelle, Formwechsel oder
 * Bestandsänderung (oder mit verändertem Abstand). Zonen ohne jede Wirkung fehlen – sie bleiben ungefärbt.
 * Reihenfolge wie `zones` (Insel), unbekannte Zonen danach. Richtung je Zone aus `idealDistance`; fehlt der
 * Eintrag, entscheidet die Mehrheit der `toward`-Angaben ihrer Wertänderungen.
 */
export function zoneEffects(
  preview: PreviewView | null,
  zones: readonly { id: string; geographyName: string }[] = [],
): ZoneEffect[] {
  if (!preview) return [];
  const byZone = new Map<string, ZoneEffect>();
  const entry = (zone: string, name?: string): ZoneEffect => {
    let e = byZone.get(zone);
    if (!e) {
      e = {
        zone,
        zoneName: name ?? zones.find((z) => z.id === zone)?.geographyName ?? zone,
        toward: 'neutral',
        distance: null,
        changes: [],
        triggers: [],
        formChanges: [],
        populationChanges: [],
      };
      byZone.set(zone, e);
    }
    return e;
  };
  for (const c of preview.changes) if (c.from !== c.to) entry(c.zone, c.zoneName).changes.push(c);
  for (const x of preview.triggers) entry(x.zone, x.zoneName).triggers.push(x);
  for (const f of preview.formChanges) entry(f.zone, f.zoneName).formChanges.push(f);
  for (const p of preview.populationChanges) entry(p.zone, p.zoneName).populationChanges.push(p);
  for (const d of preview.idealDistance ?? []) {
    if (!byZone.has(d.zone) && d.before === d.after) continue;
    entry(d.zone).distance = { before: d.before, after: d.after };
  }
  for (const e of byZone.values()) {
    if (e.distance) e.toward = towardFromDistance(e.distance.before, e.distance.after);
    else {
      const score = e.changes.reduce((s, c) => s + (c.toward === 'better' ? 1 : c.toward === 'worse' ? -1 : 0), 0);
      e.toward = score > 0 ? 'better' : score < 0 ? 'worse' : 'neutral';
    }
  }
  const order = (zone: string) => {
    const i = zones.findIndex((z) => z.id === zone);
    return i < 0 ? zones.length : i;
  };
  return [...byZone.values()].sort((a, b) => order(a.zone) - order(b.zone));
}

/** Einfärbung aller betroffenen Zonen einer Weltkarte (grün näher, rot weiter weg, gelb gleich). */
export function worldTints(effects: readonly ZoneEffect[]): Map<string, Toward> {
  return new Map(effects.map((e) => [e.zone, e.toward]));
}

/**
 * Bilanz einer Weltkarte: wie viele Zonen näher ans Ideal, weiter weg bzw. gleich weit. Bewusst keine
 * Gesamtpunktzahl und keine Empfehlung – die Gewichtung trifft der Spieler.
 */
export function worldBalance(effects: readonly ZoneEffect[]): Record<Toward, number> {
  const out: Record<Toward, number> = { better: 0, worse: 0, neutral: 0 };
  for (const e of effects) out[e.toward] += 1;
  return out;
}
