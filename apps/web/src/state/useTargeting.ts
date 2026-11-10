import { useCallback, useMemo, useState } from 'react';
import type { CardView, GameView, Targets } from '@core/api';
import type { GameClient, PreviewView } from '../client/index.ts';

interface Selection {
  uid: number;
  targets: Targets;
}

/** Slot-Arten, die durch Antippen einer Zone gefüllt werden. */
const ZONE_KINDS = new Set(['zone', 'neighbor']);

/**
 * Führt durch einen Kartenzug: Karte wählen → Slot für Slot eine gültige Zone antippen → Vorschau → „Spielen“.
 * Gültige Zonen kommen vom Client (`legalTargets`, in der Engine über `legalPlays`), nie aus App-Regeln.
 * Sind alle Slots belegt, ersetzt ein weiteres Antippen die Wahl des letzten Slots (Vorschauen vergleichen).
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
  /** Slot, den ein Antippen gerade füllt: der nächste offene oder (wenn vollständig) der letzte. */
  const editSlot = slot ?? (complete ? active.card.slots.at(-1) : undefined);

  const validZones = useMemo<Set<string>>(() => {
    if (!active || !editSlot || !ZONE_KINDS.has(editSlot.kind)) return new Set();
    const chosen = { ...active.targets };
    delete chosen[editSlot.id];
    return new Set(client.legalTargets(active.card.uid, chosen));
  }, [client, active, editSlot]);

  const preview = useMemo<PreviewView | null>(() => {
    if (!active || !complete) return null;
    return client.preview(active.card.uid, active.targets);
  }, [client, active, complete]);

  const start = useCallback((c: CardView) => {
    if (!c.playable) return;
    setSelection({ uid: c.uid, targets: {} });
  }, []);

  const cancel = useCallback(() => setSelection(null), []);

  const pickZone = useCallback(
    (zoneId: string) => {
      if (!active || !editSlot || !validZones.has(zoneId)) return;
      setSelection({ uid: active.card.uid, targets: { ...active.targets, [editSlot.id]: zoneId } });
    },
    [active, editSlot, validZones],
  );

  const confirm = useCallback(() => {
    if (!active || !complete) return;
    setSelection(null);
    onComplete(active.card.uid, active.targets);
  }, [active, complete, onComplete]);

  return {
    targeting: active,
    slot,
    complete,
    validZones,
    preview,
    start,
    cancel,
    pickZone,
    confirm,
    slotSupported: !slot || ZONE_KINDS.has(slot.kind),
  };
}
