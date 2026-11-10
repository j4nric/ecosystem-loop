import { useCallback, useMemo, useState } from 'react';
import type { CardView, GameView, Targets } from '@core/api';
import type { GameClient, PreviewView } from '../client/index.ts';

interface Selection {
  uid: number;
  targets: Targets;
}

/** Slot-Arten, die durch Antippen einer Zone gefüllt werden. */
const ZONE_KINDS = new Set(['zone', 'neighbor']);
/** Slot-Arten, die über eine Auswahlliste (Chips) gefüllt werden: Art in einer Zone, feste Wahl (z. B. Abwenden). */
const CHIP_KINDS = new Set(['species', 'choice']);

export const isZoneSlot = (kind: string) => ZONE_KINDS.has(kind);

export interface ChipOption {
  id: string;
  name: string;
  /** Bestand in der Zone des Bezugs-Slots (nur bei Art-Slots). */
  count: number | null;
}

/**
 * Führt durch einen Kartenzug: Karte wählen → Slot für Slot eine gültige Zone antippen bzw. eine Art oder Option wählen →
 * Vorschau → „Spielen“. Gültige Ziele kommen vom Client (`legalTargets`, in der Engine über `legalPlays`),
 * nie aus App-Regeln. Sind alle Slots belegt, ersetzt eine weitere Wahl die des letzten Slots (Vorschauen
 * vergleichen); eine Zone, die für den ersten Slot gültig ist, beginnt die Zielwahl dort neu.
 */
export function useTargeting(client: GameClient, view: GameView, onComplete: (uid: number, targets: Targets) => void) {
  const [selection, setSelection] = useState<Selection | null>(null);

  // Karte immer aus der aktuellen View lesen; ist sie nicht mehr auf der Hand, endet die Auswahl.
  const active = useMemo(() => {
    const card = selection ? view.hand.find((c) => c.uid === selection.uid) : undefined;
    return card && selection ? { card, targets: selection.targets } : null;
  }, [selection, view.hand]);
  const slot = active?.card.slots.find((s) => active.targets[s.id] === undefined);
  const complete = active !== null && slot === undefined;
  /** Slot, den eine Wahl gerade füllt: der nächste offene oder (wenn vollständig) der letzte. */
  const editSlot = slot ?? (complete ? active.card.slots.at(-1) : undefined);

  /** Gültige Ziele für `editSlot` (Zonen- oder Art-Ids). */
  const options = useMemo<string[]>(() => {
    if (!active || !editSlot) return [];
    const chosen = { ...active.targets };
    delete chosen[editSlot.id];
    return client.legalTargets(active.card.uid, chosen);
  }, [client, active, editSlot]);

  /** Gültige Zonen für den ersten Slot – erlaubt, die Zielwahl mit einer anderen Zone neu zu beginnen. */
  const restartZones = useMemo<Set<string>>(() => {
    const first = active?.card.slots[0];
    if (!active || !first || !isZoneSlot(first.kind) || Object.keys(active.targets).length === 0) return new Set();
    return new Set(client.legalTargets(active.card.uid, {}));
  }, [client, active]);

  const editsZone = editSlot !== undefined && isZoneSlot(editSlot.kind);
  const validZones = useMemo<Set<string>>(() => {
    if (!editsZone) return restartZones;
    return new Set(options);
  }, [editsZone, options, restartZones]);

  const chipOptions = useMemo<ChipOption[]>(() => {
    if (!active || !editSlot || !CHIP_KINDS.has(editSlot.kind)) return [];
    if (editSlot.kind === 'choice') {
      // Beschriftungen der Wahlmöglichkeiten kommen lokalisiert aus der CardView.
      return options.map((id) => ({ id, name: editSlot.options?.find((o) => o.id === id)?.label ?? id, count: null }));
    }
    // Art-Slots beziehen sich auf die Zone eines früheren Slots; deren Bestände liefern Namen und Anzahl.
    const zoneIds = new Set(Object.values(active.targets));
    const pops = view.zones.filter((z) => zoneIds.has(z.id)).flatMap((z) => z.populations);
    return options.map((id) => {
      const pop = pops.find((p) => p.species === id);
      return { id, name: pop?.name ?? client.speciesName(id), count: pop?.count ?? null };
    });
  }, [client, active, editSlot, options, view.zones]);

  const preview = useMemo<PreviewView | null>(() => {
    if (!active || !complete) return null;
    return client.preview(active.card.uid, active.targets);
  }, [client, active, complete]);

  const start = useCallback((c: CardView) => {
    if (!c.playable) return;
    setSelection({ uid: c.uid, targets: {} });
  }, []);

  /** Beginnt die Zielwahl mit gesetztem ersten Slot (Karte auf Zone gezogen). false, wenn die Zone ungültig ist. */
  const startAt = useCallback(
    (c: CardView, zoneId: string): boolean => {
      const first = c.slots[0];
      if (!c.playable || !first || !isZoneSlot(first.kind)) return false;
      if (!client.legalTargets(c.uid, {}).includes(zoneId)) return false;
      setSelection({ uid: c.uid, targets: { [first.id]: zoneId } });
      return true;
    },
    [client],
  );

  const cancel = useCallback(() => setSelection(null), []);

  const pickZone = useCallback(
    (zoneId: string) => {
      if (!active) return;
      if (editsZone && editSlot && options.includes(zoneId)) {
        setSelection({ uid: active.card.uid, targets: { ...active.targets, [editSlot.id]: zoneId } });
        return;
      }
      const first = active.card.slots[0];
      if (first && restartZones.has(zoneId)) setSelection({ uid: active.card.uid, targets: { [first.id]: zoneId } });
    },
    [active, editSlot, editsZone, options, restartZones],
  );

  const pickChip = useCallback(
    (optionId: string) => {
      if (!active || !editSlot || !CHIP_KINDS.has(editSlot.kind) || !options.includes(optionId)) return;
      setSelection({ uid: active.card.uid, targets: { ...active.targets, [editSlot.id]: optionId } });
    },
    [active, editSlot, options],
  );

  const confirm = useCallback(() => {
    if (!active || !complete) return;
    setSelection(null);
    onComplete(active.card.uid, active.targets);
  }, [active, complete, onComplete]);

  return {
    targeting: active,
    slot,
    editSlot,
    complete,
    validZones,
    chipOptions,
    /** true, wenn der aktuelle Slot über Chips gewählt wird. */
    chipSlot: editSlot !== undefined && CHIP_KINDS.has(editSlot.kind),
    /** Gewählte Option des Chip-Slots (für die Markierung in der Auswahl). */
    chosenChip: active && editSlot && CHIP_KINDS.has(editSlot.kind) ? (active.targets[editSlot.id] ?? null) : null,
    preview,
    start,
    startAt,
    cancel,
    pickZone,
    pickChip,
    confirm,
    slotSupported: !slot || ZONE_KINDS.has(slot.kind) || CHIP_KINDS.has(slot.kind),
  };
}
