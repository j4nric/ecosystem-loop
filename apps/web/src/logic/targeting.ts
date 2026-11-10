import type { CardView, Targets, ZoneView } from '@core/api';

/**
 * Reine Bausteine der Zielwahl (ohne React): welcher Slot ist offen, was bewirkt ein Antippen von Zone oder Chip.
 * Gültige Ziele kommen immer aus der Engine (`legalTargets`) und werden hier nur angewendet.
 */

export type Slot = CardView['slots'][number];

/** Slot-Arten, die durch Antippen einer Zone gefüllt werden. */
const ZONE_KINDS = new Set(['zone', 'neighbor']);
/** Slot-Arten, die über eine Auswahlliste (Chips) gefüllt werden: Art in einer Zone, feste Wahl (z. B. Abwenden). */
const CHIP_KINDS = new Set(['species', 'choice']);

export const isZoneSlot = (kind: string) => ZONE_KINDS.has(kind);
export const isChipSlot = (kind: string) => CHIP_KINDS.has(kind);
/** Kann die App diese Slot-Art bedienen? */
export const isSupportedSlot = (kind: string) => isZoneSlot(kind) || isChipSlot(kind);

export interface ChipOption {
  id: string;
  name: string;
  /** Bestand in der Zone des Bezugs-Slots (nur bei Art-Slots). */
  count: number | null;
}

/** Nächster noch offener Slot; undefined, wenn alle belegt sind. */
export function openSlot(card: CardView, targets: Targets): Slot | undefined {
  return card.slots.find((s) => targets[s.id] === undefined);
}

/** Slot, den eine Wahl gerade füllt: der nächste offene oder (wenn vollständig) der letzte. */
export function editSlotOf(card: CardView, targets: Targets): Slot | undefined {
  return openSlot(card, targets) ?? card.slots.at(-1);
}

/** Bisherige Auswahl ohne den Slot, der gerade bearbeitet wird (Grundlage für `legalTargets`). */
export function chosenWithout(targets: Targets, slot: Slot | undefined): Targets {
  const chosen = { ...targets };
  if (slot) delete chosen[slot.id];
  return chosen;
}

/** Zielwahl auf einer Zone beginnen (Karte auf die Insel gezogen): Ziele oder null, wenn die Zone ungültig ist. */
export function startTargets(card: CardView, firstOptions: readonly string[], zoneId: string): Targets | null {
  const first = card.slots[0];
  if (!card.playable || !first || !isZoneSlot(first.kind) || !firstOptions.includes(zoneId)) return null;
  return { [first.id]: zoneId };
}

/**
 * Antippen einer Zone während der Zielwahl. Gültig für den bearbeiteten Zonen-Slot ⇒ dort eintragen;
 * sonst, wenn sie für den ersten Slot gültig ist (`restartZones`), die Zielwahl dort neu beginnen; sonst null.
 */
export function pickZoneTargets(
  card: CardView,
  targets: Targets,
  options: readonly string[],
  restartZones: ReadonlySet<string>,
  zoneId: string,
): Targets | null {
  const slot = editSlotOf(card, targets);
  if (slot && isZoneSlot(slot.kind) && options.includes(zoneId)) return { ...targets, [slot.id]: zoneId };
  const first = card.slots[0];
  if (first && restartZones.has(zoneId)) return { [first.id]: zoneId };
  return null;
}

/** Wahl eines Chips (Art oder Option) für den bearbeiteten Chip-Slot; null, wenn nicht gültig. */
export function pickChipTargets(
  card: CardView,
  targets: Targets,
  options: readonly string[],
  optionId: string,
): Targets | null {
  const slot = editSlotOf(card, targets);
  if (!slot || !isChipSlot(slot.kind) || !options.includes(optionId)) return null;
  return { ...targets, [slot.id]: optionId };
}

/**
 * Chips für den bearbeiteten Slot: Wahl-Slots mit ihren lokalisierten Beschriftungen, Art-Slots mit Namen und
 * Bestand aus den Zonen, die schon gewählt sind.
 */
export function chipOptionsFor(
  slot: Slot | undefined,
  options: readonly string[],
  targets: Targets,
  zones: readonly ZoneView[],
  speciesName: (id: string) => string,
): ChipOption[] {
  if (!slot || !isChipSlot(slot.kind)) return [];
  if (slot.kind === 'choice')
    return options.map((id) => ({ id, name: slot.options?.find((o) => o.id === id)?.label ?? id, count: null }));
  const zoneIds = new Set(Object.values(targets));
  const pops = zones.filter((z) => zoneIds.has(z.id)).flatMap((z) => z.populations);
  return options.map((id) => {
    const pop = pops.find((p) => p.species === id);
    return { id, name: pop?.name ?? speciesName(id), count: pop?.count ?? null };
  });
}

// --- Ziehen und langer Druck auf Handkarten -------------------------------------------------------

/** Ab dieser Strecke (px) wird aus einem Antippen ein Ziehen. */
export const DRAG_START_PX = 12;
/** Ab dieser Haltedauer (ms) ohne Ziehen zeigt die App den vollen Kartentext. */
export const LONG_PRESS_MS = 450;

/** Lässt sich die Karte auf die Insel ziehen? (spielbar, erster Slot ist eine Zone) */
export function canDrag(card: CardView): boolean {
  const first = card.slots[0];
  return card.playable && first !== undefined && isZoneSlot(first.kind);
}

/** Hat sich der Finger weit genug bewegt, dass aus dem Druck ein Ziehen (bzw. kein langer Druck) wird? */
export function movedBeyond(from: { x: number; y: number }, to: { x: number; y: number }, px = DRAG_START_PX) {
  return Math.hypot(to.x - from.x, to.y - from.y) >= px;
}

/** Zone, auf der eine gezogene Karte landet: nur, wenn die Engine sie für den ersten Slot erlaubt. */
export function dropZone(zone: string | null, firstOptions: readonly string[]): string | null {
  return zone !== null && firstOptions.includes(zone) ? zone : null;
}
