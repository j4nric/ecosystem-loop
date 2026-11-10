import { useCallback, useMemo, useState } from 'react';
import type { CardView, GameView, Targets } from '@core/api';
import type { GameClient, PreviewView } from '../client/index.ts';
import {
  chipOptionsFor,
  chosenWithout,
  editSlotOf,
  isChipSlot,
  isSupportedSlot,
  isZoneSlot,
  openSlot,
  pickChipTargets,
  pickZoneTargets,
  startTargets,
  type ChipOption,
} from '../logic/targeting.ts';
import {
  completesCard,
  isWorldCard,
  worldTints,
  zoneEffects,
  zoneTints,
  type Toward,
  type ZoneEffect,
} from '../logic/ideal.ts';

interface Selection {
  uid: number;
  targets: Targets;
}

/**
 * Führt durch einen Kartenzug: Karte wählen → Slot für Slot eine gültige Zone antippen bzw. eine Art oder Option wählen →
 * Vorschau → „Spielen“. Gültige Ziele kommen vom Client (`legalTargets`, in der Engine über `legalPlays`),
 * nie aus App-Regeln. Sind alle Slots belegt, ersetzt eine weitere Wahl die des letzten Slots (Vorschauen
 * vergleichen); eine Zone, die für den ersten Slot gültig ist, beginnt die Zielwahl dort neu.
 * Die Übergänge selbst sind reine Funktionen in `logic/targeting.ts`.
 *
 * Weltkarten (Wetter, `reach: 'world'`) haben keine Zonen-Slots: Nach dem Start ist der Zug sofort vollständig
 * (bzw. nach dem einen Wahl-Slot), und die eine Vorschau färbt alle betroffenen Zonen zugleich (`effects`).
 */
export function useTargeting(client: GameClient, view: GameView, onComplete: (uid: number, targets: Targets) => void) {
  const [selection, setSelection] = useState<Selection | null>(null);

  // Karte immer aus der aktuellen View lesen; ist sie nicht mehr auf der Hand, endet die Auswahl.
  const active = useMemo(() => {
    const card = selection ? view.hand.find((c) => c.uid === selection.uid) : undefined;
    return card && selection ? { card, targets: selection.targets } : null;
  }, [selection, view.hand]);
  const slot = active ? openSlot(active.card, active.targets) : undefined;
  const complete = active !== null && slot === undefined;
  const editSlot = active ? editSlotOf(active.card, active.targets) : undefined;

  /** Gültige Ziele für `editSlot` (Zonen-, Art- oder Options-Ids). */
  const options = useMemo<string[]>(() => {
    if (!active || !editSlot) return [];
    return client.legalTargets(active.card.uid, chosenWithout(active.targets, editSlot));
  }, [client, active, editSlot]);

  /** Gültige Zonen für den ersten Slot – erlaubt, die Zielwahl mit einer anderen Zone neu zu beginnen. */
  const restartZones = useMemo<Set<string>>(() => {
    const first = active?.card.slots[0];
    if (!active || !first || !isZoneSlot(first.kind) || Object.keys(active.targets).length === 0) return new Set();
    return new Set(client.legalTargets(active.card.uid, {}));
  }, [client, active]);

  const preview = useMemo<PreviewView | null>(() => {
    if (!active || !complete) return null;
    return client.preview(active.card.uid, active.targets);
  }, [client, active, complete]);

  /** Weltkarte: keine Zonenwahl, die Vorschau wirkt auf alle betroffenen Zonen zugleich. */
  const world = active !== null && isWorldCard(active.card);
  const effects = useMemo<ZoneEffect[]>(
    () => (world ? zoneEffects(preview, view.zones) : []),
    [world, preview, view.zones],
  );

  const editsZone = editSlot !== undefined && isZoneSlot(editSlot.kind);
  const validZones = useMemo<Set<string>>(() => {
    if (world) return new Set(effects.map((e) => e.zone));
    return editsZone ? new Set(options) : restartZones;
  }, [world, effects, editsZone, options, restartZones]);

  /**
   * Einfärbung der wählbaren Zonen nach Wirkung auf die Idealform (grün näher, rot weiter weg). Nur, wenn die
   * Wahl dieses Zonen-Slots den Zug vervollständigt – dann gibt es für jede Kandidatenzone eine Vorschau.
   * Weltkarte: alle betroffenen Zonen aus der einen Vorschau.
   */
  const tints = useMemo<Map<string, Toward>>(() => {
    if (world) return worldTints(effects);
    if (!active || !editSlot || !editsZone || !completesCard(active.card, editSlot.id)) return new Map();
    const base = chosenWithout(active.targets, editSlot);
    return zoneTints(options, (zone) => client.preview(active.card.uid, { ...base, [editSlot.id]: zone }));
  }, [client, world, effects, active, editSlot, editsZone, options]);

  const chipOptions = useMemo<ChipOption[]>(
    () => (active ? chipOptionsFor(editSlot, options, active.targets, view.zones, (id) => client.speciesName(id)) : []),
    [client, active, editSlot, options, view.zones],
  );

  const start = useCallback((c: CardView) => {
    if (!c.playable) return;
    setSelection({ uid: c.uid, targets: {} });
  }, []);

  /** Beginnt die Zielwahl mit gesetztem ersten Slot (Karte auf Zone gezogen). false, wenn die Zone ungültig ist. */
  const startAt = useCallback(
    (c: CardView, zoneId: string): boolean => {
      const targets = startTargets(c, c.playable ? client.legalTargets(c.uid, {}) : [], zoneId);
      if (!targets) return false;
      setSelection({ uid: c.uid, targets });
      return true;
    },
    [client],
  );

  const cancel = useCallback(() => setSelection(null), []);

  const pickZone = useCallback(
    (zoneId: string) => {
      if (!active) return;
      const targets = pickZoneTargets(active.card, active.targets, options, restartZones, zoneId);
      if (targets) setSelection({ uid: active.card.uid, targets });
    },
    [active, options, restartZones],
  );

  const pickChip = useCallback(
    (optionId: string) => {
      if (!active) return;
      const targets = pickChipTargets(active.card, active.targets, options, optionId);
      if (targets) setSelection({ uid: active.card.uid, targets });
    },
    [active, options],
  );

  const confirm = useCallback(() => {
    if (!active || !complete) return;
    setSelection(null);
    onComplete(active.card.uid, active.targets);
  }, [active, complete, onComplete]);

  const chipSlot = editSlot !== undefined && isChipSlot(editSlot.kind);
  return {
    targeting: active,
    slot,
    editSlot,
    complete,
    validZones,
    tints,
    chipOptions,
    /** true, wenn der aktuelle Slot über Chips gewählt wird. */
    chipSlot,
    /** Gewählte Option des Chip-Slots (für die Markierung in der Auswahl). */
    chosenChip: active && editSlot && chipSlot ? (active.targets[editSlot.id] ?? null) : null,
    preview,
    /** true bei einer Weltkarte (Wetter): Wirkung auf alle Zonen, keine Zonenwahl. */
    world,
    /** Wirkung je betroffener Zone (nur Weltkarten). */
    effects,
    start,
    startAt,
    cancel,
    pickZone,
    pickChip,
    confirm,
    slotSupported: !slot || isSupportedSlot(slot.kind),
  };
}
