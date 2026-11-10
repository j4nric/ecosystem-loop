import { useCallback, useMemo, useState } from 'react';
import type { CardView, GameView, Targets } from '@core/api';

export interface Targeting {
  card: CardView;
  targets: Targets;
  slotIndex: number;
}

/** Slot-Arten, die durch Antippen einer Zone gefüllt werden. */
const ZONE_KINDS = new Set(['zone', 'neighbor']);

/**
 * Führt durch die Zielwahl einer Karte: Slot für Slot wird eine Zone angetippt.
 * `neighbor` erlaubt nur Nachbarn der zuvor gewählten Zone (der Slot sagt noch nicht, wovon – siehe Engine-Wunsch).
 */
export function useTargeting(view: GameView, onComplete: (uid: number, targets: Targets) => void) {
  const [targeting, setTargeting] = useState<Targeting | null>(null);

  const start = useCallback(
    (card: CardView) => {
      if (!card.playable) return;
      if (card.slots.length === 0) {
        onComplete(card.uid, {});
        return;
      }
      setTargeting({ card, targets: {}, slotIndex: 0 });
    },
    [onComplete],
  );

  const cancel = useCallback(() => setTargeting(null), []);

  const slot = targeting ? targeting.card.slots[targeting.slotIndex] : undefined;

  const validZones = useMemo<Set<string>>(() => {
    if (!targeting || !slot || !ZONE_KINDS.has(slot.kind)) return new Set();
    if (slot.kind === 'neighbor') {
      const previous = Object.values(targeting.targets).at(-1);
      const zone = view.zones.find((z) => z.id === previous);
      return new Set(zone ? zone.neighbors : []);
    }
    return new Set(view.zones.map((z) => z.id));
  }, [targeting, slot, view.zones]);

  const pickZone = useCallback(
    (zoneId: string) => {
      if (!targeting || !slot || !validZones.has(zoneId)) return;
      const targets = { ...targeting.targets, [slot.id]: zoneId };
      const nextIndex = targeting.slotIndex + 1;
      if (nextIndex >= targeting.card.slots.length) {
        setTargeting(null);
        onComplete(targeting.card.uid, targets);
      } else {
        setTargeting({ ...targeting, targets, slotIndex: nextIndex });
      }
    },
    [targeting, slot, validZones, onComplete],
  );

  return { targeting, slot, validZones, start, cancel, pickZone, slotSupported: !slot || ZONE_KINDS.has(slot.kind) };
}
